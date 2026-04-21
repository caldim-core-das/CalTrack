from datetime import date, datetime, timedelta

from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole
from employees.models import Employee

from .models import Break, TimeLog, JobSite, TimeLogPhoto, Location
from .serializers import TimeLogSerializer, TimeLogPhotoSerializer, JobSiteSerializer, LocationSerializer
from .utils import calculate_distance, generate_shift_summary_pdf, send_shift_summary_email, verify_face_match
from django.http import HttpResponse
from rest_framework.decorators import action


class JobSiteViewSet(viewsets.ModelViewSet):
    serializer_class = JobSiteSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        return [IsAdminRole()]

    def get_queryset(self):
        # Admins can see all, employees can see all for now to show on map
        return JobSite.objects.all().order_by("name")

    def perform_create(self, serializer):
        # Auto-assign organization from current admin's employee profile
        try:
            employee = self.request.user.employee_profile
            serializer.save(organization=employee.organization)
        except Exception:
            serializer.save()


class LocationViewSet(viewsets.ModelViewSet):
    """CRUD for saved locations (Settings > Locations)."""
    serializer_class = LocationSerializer

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Location.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        org = None
        try:
            org = getattr(self.request.user, 'organization', None)
        except Exception:
            pass
        if not org:
            try:
                emp = self.request.user.employee_profile
                org = emp.organization
            except Exception:
                pass
        if org:
            serializer.save(organization=org)
        else:
            serializer.save()


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def _get_employee_for_request(request, employee_id: str | None) -> Employee | None:
    if request.user.role == "admin" and employee_id:
        return Employee.objects.filter(id=employee_id).first()
    return Employee.objects.filter(user=request.user).first()


class TimeLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TimeLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        time_log = self.get_object()
        pdf_content = generate_shift_summary_pdf(time_log)
        filename = f"Shift_Summary_{time_log.work_date}_{time_log.employee.user.username}.pdf"
        response = HttpResponse(pdf_content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def get_queryset(self):
        qs = TimeLog.objects.select_related("employee", "employee__user").prefetch_related("breaks")

        # Date range filters (work_date)
        date_from = _parse_date(self.request.query_params.get("date_from"))
        date_to   = _parse_date(self.request.query_params.get("date_to"))
        if date_from:
            qs = qs.filter(work_date__gte=date_from)
        if date_to:
            qs = qs.filter(work_date__lte=date_to)

        if self.request.user.role == "admin":
            return qs.order_by("-clock_in")
        employee = Employee.objects.filter(user=self.request.user).first()
        if not employee:
            return qs.none()
        return qs.filter(employee=employee).order_by("-clock_in")



class ClockInView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        open_log = TimeLog.objects.filter(employee=employee, clock_out__isnull=True).first()
        if open_log:
            return Response({"detail": "Already clocked in."}, status=400)
        now = timezone.now()
        lat = request.data.get("lat")
        lon = request.data.get("lon")
        address = request.data.get("address", "")
        notes = request.data.get("notes", "")
        photo = request.FILES.get("photo")

        # Geofence check
        job_site = employee.assigned_job_site
        organization = request.user.organization
        
        distance = None
        passed = True
        override_used = False
        
        if job_site and organization and organization.geofence_enabled:
            if lat and lon:
                distance = calculate_distance(lat, lon, job_site.lat, job_site.lng)
                radius = job_site.geofence_radius or organization.geofence_radius_meters
                
                if distance > radius:
                    passed = False
                    if organization.geofence_strict_mode:
                        # Allow admin override if enabled
                        if organization.geofence_admin_override and request.user.role == "admin":
                            override_used = True
                            passed = True # Override means it passes
                        else:
                            # Blocked
                            dist_km = round(distance / 1000, 1)
                            return Response({
                                "success": False,
                                "message": f"You are {dist_km} km from the job site. Move closer to clock in.",
                                "distance": distance,
                                "radius": radius
                            }, status=403)

        time_log = TimeLog.objects.create(
            employee=employee,
            work_date=timezone.localdate(),
            clock_in=now,
            clock_in_lat=lat,
            clock_in_lon=lon,
            clock_in_address=address,
            clock_in_notes=notes,
            clock_in_photo=photo,
            distance_from_site_meters=distance,
            geofence_passed=passed,
            admin_override_used=override_used
        )
        return Response(TimeLogSerializer(time_log).data, status=201)


class ClockOutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        time_log = TimeLog.objects.filter(employee=employee, clock_out__isnull=True).order_by("-clock_in").first()
        if not time_log:
            return Response({"detail": "No open time log."}, status=400)
        open_break = Break.objects.filter(time_log=time_log, break_end__isnull=True).order_by("-break_start").first()
        if open_break:
            open_break.break_end = timezone.now()
            open_break.save(update_fields=["break_end"])
        time_log.clock_out = timezone.now()
        time_log.clock_out_lat = request.data.get("lat")
        time_log.clock_out_lon = request.data.get("lon")
        time_log.clock_out_address = request.data.get("address", "")
        time_log.clock_out_notes = request.data.get("notes", "")
        if "photo" in request.FILES:
            time_log.clock_out_photo = request.FILES["photo"]
        
        # Record face verification result from client-side check
        face_status = request.data.get("face_match_status")
        face_score = request.data.get("face_match_score")
        if face_status:
            time_log.face_match_status = face_status
        if face_score is not None:
            try:
                time_log.face_match_score = float(face_score)
            except (ValueError, TypeError):
                pass

        time_log.save()
        
        # If this time log is linked to a task, complete the task
        try:
            task = time_log.task
            if task and task.status != "completed":
                task.status = "completed"
                task.completed_at = timezone.now()
                if not task.started_at:
                    task.started_at = time_log.clock_in
                task.save()
        except (AttributeError, Exception):
            pass

        try:
            send_shift_summary_email(time_log)
        except Exception:
            pass
        
        return Response(TimeLogSerializer(time_log).data)


class BreakStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        time_log = TimeLog.objects.filter(employee=employee, clock_out__isnull=True).order_by("-clock_in").first()
        if not time_log:
            return Response({"detail": "No open time log."}, status=400)
        open_break = Break.objects.filter(time_log=time_log, break_end__isnull=True).first()
        if open_break:
            return Response({"detail": "Break already started."}, status=400)
        break_obj = Break.objects.create(
            time_log=time_log, 
            break_start=timezone.now(),
            break_type=request.data.get("break_type", "lunch")
        )
        time_log.refresh_from_db()
        return Response(TimeLogSerializer(time_log).data)


class BreakEndView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        time_log = TimeLog.objects.filter(employee=employee, clock_out__isnull=True).order_by("-clock_in").first()
        if not time_log:
            return Response({"detail": "No open time log."}, status=400)
        open_break = Break.objects.filter(time_log=time_log, break_end__isnull=True).order_by("-break_start").first()
        if not open_break:
            return Response({"detail": "No open break."}, status=400)
        open_break.break_end = timezone.now()
        open_break.save(update_fields=["break_end"])
        time_log.refresh_from_db()
        return Response(TimeLogSerializer(time_log).data)


class TimesheetView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        print("DEBUG: TimesheetView.get called")
        try:
            res = self._handle_get(request)
            print("DEBUG: TimesheetView.get success")
            return res
        except Exception as e:
            print(f"DEBUG: TimesheetView.get ERROR: {e}")
            import traceback
            tb = traceback.format_exc()
            print(tb)
            with open("traceback_debug_v2.txt", "w") as f:
                f.write(tb)
            raise

    def _handle_get(self, request):
        employee = _get_employee_for_request(request, request.query_params.get("employee"))
        if not employee:
            # Admin user or user without an employee profile — return an empty valid response
            return Response({
                "employee": None,
                "range": {},
                "entries": [],
                "daily": [],
                "weekly": [],
                "totals": {"hours": 0, "daily_overtime_hours": 0, "weekly_overtime_hours": 0},
            })

        start = _parse_date(request.query_params.get("start")) or (timezone.localdate() - timedelta(days=7))
        end = _parse_date(request.query_params.get("end")) or timezone.localdate()

        qs = (
            TimeLog.objects.filter(employee=employee, work_date__gte=start, work_date__lte=end)
            .order_by("work_date", "clock_in")
        )

        entries = []
        daily_totals = {}
        for log in qs:
            worked_hours = log.worked_seconds() / 3600
            # Explicitly format dates and datetimes
            clock_in = log.clock_in.isoformat() if log.clock_in else None
            clock_out = log.clock_out.isoformat() if log.clock_out else None
            
            entries.append(
                {
                    "id": str(log.id),
                    "work_date": str(log.work_date),
                    "clock_in": clock_in,
                    "clock_in_lat": str(log.clock_in_lat) if log.clock_in_lat else None,
                    "clock_in_lon": str(log.clock_in_lon) if log.clock_in_lon else None,
                    "clock_in_address": log.clock_in_address,
                    "clock_in_notes": log.clock_in_notes,
                    "clock_in_photo": request.build_absolute_uri(log.clock_in_photo.url) if log.clock_in_photo else None,
                    "clock_out": clock_out,
                    "clock_out_lat": str(log.clock_out_lat) if log.clock_out_lat else None,
                    "clock_out_lon": str(log.clock_out_lon) if log.clock_out_lon else None,
                    "clock_out_address": log.clock_out_address,
                    "clock_out_notes": log.clock_out_notes,
                    "clock_out_photo": request.build_absolute_uri(log.clock_out_photo.url) if log.clock_out_photo else None,
                    "break_seconds": log.break_seconds(),
                    "worked_hours": round(worked_hours, 2),
                    "worked_seconds": log.worked_seconds(),
                }
            )
            daily_totals.setdefault(log.work_date, {"hours": 0.0, "seconds": 0})
            daily_totals[log.work_date]["hours"] += worked_hours
            daily_totals[log.work_date]["seconds"] += log.worked_seconds()

        daily = []
        total_hours = 0.0
        total_seconds = 0
        for d, data in sorted(daily_totals.items(), key=lambda x: str(x[0])):
            hours = data["hours"]
            seconds = data["seconds"]
            ot = max(0.0, hours - 8.0)
            daily.append({
                "date": str(d), 
                "hours": round(hours, 2), 
                "seconds": seconds,
                "overtime_hours": round(ot, 2),
            })
            total_hours += hours
            total_seconds += seconds

        # ✅ FIXED — extract just the float hours value
        weekly_hours = {}
        for d, data in daily_totals.items():
            y, w, _ = d.isocalendar()
            weekly_hours.setdefault((y, w), 0.0)
            weekly_hours[(y, w)] += data["hours"]  # ← extract hours from dict

        weekly = []
        for (y, w), hours in sorted(weekly_hours.items(), key=lambda x: str(x[0])):
            ot = max(0.0, hours - 40.0)
            weekly.append({"iso_year": y, "iso_week": w, "hours": round(hours, 2), "overtime_hours": round(ot, 2)})

        return Response(
            {
                "employee": {"id": str(employee.id), "employee_id": employee.employee_id},
                "range": {"start": str(start), "end": str(end)},
                "entries": entries,
                "daily": daily,
                "weekly": weekly,
                "totals": {
                    "hours": round(total_hours, 2),
                    "seconds": total_seconds,
                    "daily_overtime_hours": 0.0,
                    "weekly_overtime_hours": 0.0,
                },
            }
        )
        


class AdminEmployeeTimeLogsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request, employee_id: str):
        employee = Employee.objects.filter(id=employee_id).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        qs = TimeLog.objects.filter(employee=employee).prefetch_related("breaks").order_by("-clock_in")
        return Response(TimeLogSerializer(qs, many=True).data)


class TimeGeofenceStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        
        job_site = employee.assigned_job_site
        organization = request.user.organization
        
        data = {
            "geofence_enabled": organization.geofence_enabled if organization else False,
            "strict_mode": organization.geofence_strict_mode if organization else True,
            "admin_override": organization.geofence_admin_override if organization else True,
            "org_radius": organization.geofence_radius_meters if organization else 200,
            "job_site": None
        }
        
        if job_site:
            data["job_site"] = {
                "id": str(job_site.id),
                "name": job_site.name,
                "lat": float(job_site.lat),
                "lng": float(job_site.lng),
                "radius_override": job_site.geofence_radius
            }
            
        return Response(data)


class UploadJobPhotoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        
        time_log = TimeLog.objects.filter(employee=employee, clock_out__isnull=True).order_by("-clock_in").first()
        if not time_log:
            return Response({"detail": "No active time log found. Please clock in first."}, status=400)
            
        photo = request.FILES.get("photo")
        photo_type = request.data.get("photo_type", "progress")
        caption = request.data.get("caption", "")
        
        if not photo:
            return Response({"detail": "No photo provided."}, status=400)
            
        log_photo = TimeLogPhoto.objects.create(
            time_log=time_log,
            photo=photo,
            photo_type=photo_type,
            caption=caption
        )
        
        return Response(TimeLogPhotoSerializer(log_photo).data, status=201)


class JobSitePhotosView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Admins see all, employees see their own (or all if needed, but let's stick to related logs)
        if request.user.role == "admin":
            qs = TimeLogPhoto.objects.select_related("time_log", "time_log__employee", "time_log__employee__user").order_by("-uploaded_at")
        else:
            employee = Employee.objects.filter(user=request.user).first()
            if not employee:
                return Response([])
            qs = TimeLogPhoto.objects.filter(time_log__employee=employee).order_by("-uploaded_at")
            
        data = []
        for p in qs:
            data.append({
                "id": str(p.id),
                "photo": request.build_absolute_uri(p.photo.url) if p.photo else None,
                "photo_type": p.photo_type,
                "caption": p.caption,
                "uploaded_at": p.uploaded_at,
                "employee_name": p.time_log.employee.user.get_full_name() or p.time_log.employee.user.username,
                "time_log_id": str(p.time_log.id)
            })
        return Response(data)
class TimeLogSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: str):
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        
        time_log = TimeLog.objects.filter(id=pk, employee=employee).first()
        if not time_log:
            return Response({"detail": "Time log not found."}, status=404)
        
        if time_log.clock_out is None:
            return Response({"detail": "Cannot submit an open time log. Please clock out first."}, status=400)
        
        if time_log.status != 'draft':
            return Response({"detail": f"Time log is already {time_log.status}."}, status=400)
        
        time_log.status = 'submitted'
        time_log.submitted_at = timezone.now()
        time_log.save(update_fields=['status', 'submitted_at'])
        
        return Response(TimeLogSerializer(time_log).data)


class TimeLogApprovalView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, pk: str):
        action = request.data.get("action") # "approve", "reject", "edit"
        time_log = TimeLog.objects.filter(id=pk).first()
        if not time_log:
            return Response({"detail": "Time log not found."}, status=404)
        
        if action == "approve":
            time_log.status = 'approved'
            time_log.approved_by = request.user
            time_log.admin_notes = request.data.get("admin_notes", "")
            time_log.save(update_fields=['status', 'approved_by', 'admin_notes'])
        
        elif action == "reject":
            time_log.status = 'rejected'
            time_log.admin_notes = request.data.get("admin_notes", "Rejected by admin.")
            time_log.save(update_fields=['status', 'admin_notes'])
            
        elif action == "edit":
            # Admin can adjust hours via manual_hours_correction
            try:
                correction = request.data.get("manual_hours_correction")
                if correction is not None:
                    time_log.manual_hours_correction = float(correction)
                time_log.admin_notes = request.data.get("admin_notes", time_log.admin_notes)
                time_log.save(update_fields=['manual_hours_correction', 'admin_notes'])
            except Exception as e:
                return Response({"detail": f"Invalid correction value: {e}"}, status=400)

        elif action == "force_clock_out":
            if not time_log.clock_out:
                time_log.clock_out = timezone.now()
                # Close any open breaks
                time_log.breaks.filter(break_end__isnull=True).update(break_end=timezone.now())
                time_log.admin_notes = request.data.get("admin_notes", f"Forced clock out by admin {request.user.username}")
                time_log.save(update_fields=['clock_out', 'admin_notes'])
            else:
                return Response({"detail": "Employee already clocked out."}, status=400)

        elif action == "delete":
            time_log.delete()
            return Response({"success": True, "detail": "Time log deleted."})
        
        return Response(TimeLogSerializer(time_log).data)


class CurrentSessionView(APIView):
    """Returns the currently active time log for the logged-in user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        
        open_log = TimeLog.objects.filter(employee=employee, clock_out__isnull=True).order_by("-clock_in").first()
        if not open_log:
            return Response({"active": False})
            
        return Response({
            "active": True,
            "id": str(open_log.id),
            "clock_in": open_log.clock_in,
            "job_site": employee.assigned_job_site.name if employee.assigned_job_site else "Corporate"
        })
