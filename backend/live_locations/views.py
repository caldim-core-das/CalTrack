from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.permissions import IsAdminRole
from employees.models import Employee
from time_tracking.models import TimeLog
from .models import EmployeeLocation
from .serializers import EmployeeLocationSerializer

class LiveLocationUpdateView(APIView):
    """
    Endpoint for employees to report their live location.
    Typically called periodically by the mobile/web app when clocked in.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            employee = Employee.objects.filter(user=request.user).first()
            if not employee:
                return Response({"detail": "Employee profile not found."}, status=status.HTTP_404_NOT_FOUND)
            
            # We only track location when clocked in
            time_log = TimeLog.objects.filter(employee=employee, clock_out__isnull=True).order_by("-clock_in").first()
            if not time_log:
                return Response({"detail": "You must be clocked in to report live location."}, status=status.HTTP_400_BAD_REQUEST)
            
            lat = request.data.get("lat")
            lng = request.data.get("lng")
            
            if lat is None or lng is None:
                return Response({"detail": "Latitude and longitude are required."}, status=status.HTTP_400_BAD_REQUEST)
                
            from decimal import Decimal
            try:
                lat_d = round(Decimal(str(lat)), 6)
                lng_d = round(Decimal(str(lng)), 6)
            except Exception:
                return Response({"detail": "Valid latitude and longitude are required."}, status=status.HTTP_400_BAD_REQUEST)

            location = EmployeeLocation.objects.create(
                employee=employee,
                time_log=time_log,
                lat=lat_d,
                lng=lng_d
            )
            
            return Response(EmployeeLocationSerializer(location, context={'request': request}).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            print("LiveLocationUpdateView Error:", e)
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CurrentLocationsListView(APIView):
    """
    Returns the latest location for all employees who are currently clocked in.
    Used for the "Live Map" view for admins.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        open_logs = TimeLog.objects.filter(clock_out__isnull=True).select_related('employee', 'employee__user')
        
        results = []
        for log in open_logs:
            latest_loc = EmployeeLocation.objects.filter(time_log=log).order_by('-timestamp').first()
            if latest_loc:
                results.append(EmployeeLocationSerializer(latest_loc, context={'request': request}).data)
            else:
                # Construct data manually to match serializer output
                clock_in_photo_url = None
                if log.clock_in_photo:
                    clock_in_photo_url = request.build_absolute_uri(log.clock_in_photo.url)
                
                delta = timezone.now() - log.clock_in
                
                results.append({
                    "id": f"clockin_{log.id}",
                    "employee": str(log.employee.id),
                    "employee_id_code": log.employee.employee_id,
                    "employee_name": log.employee.user.get_full_name() or log.employee.user.username,
                    "time_log": str(log.id),
                    "lat": log.clock_in_lat or 0,
                    "lng": log.clock_in_lon or 0,
                    "timestamp": log.clock_in,
                    "clock_in": log.clock_in,
                    "clock_in_photo": clock_in_photo_url,
                    "clock_in_address": log.clock_in_address,
                    "worked_seconds": int(delta.total_seconds()),
                    "job_site_name": log.employee.assigned_job_site.name if log.employee.assigned_job_site else "Corporate",
                    "is_initial": True
                })
                    
        return Response(results)


class EmployeeLocationHistoryView(APIView):
    """
    Returns the location history for a specific employee and time log.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request, employee_id):
        time_log_id = request.query_params.get('time_log_id')
        
        qs = EmployeeLocation.objects.filter(employee_id=employee_id)
        
        if time_log_id:
            qs = qs.filter(time_log_id=time_log_id)
        else:
            # Fallback to last 24 hours if no time_log_id provided
            one_day_ago = timezone.now() - timezone.timedelta(days=1)
            qs = qs.filter(timestamp__gte=one_day_ago)
            
        qs = qs.order_by('timestamp')
        return Response(EmployeeLocationSerializer(qs, many=True).data)


class EmployeeLiveSessionDetailView(APIView):
    """
    Returns full details for a specific live session (TimeLog),
    including photos, notes, and the full location history.
    Used for the "Image 2" detailed view.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request, time_log_id):
        log = TimeLog.objects.filter(id=time_log_id).select_related('employee', 'employee__user').first()
        if not log:
            return Response({"detail": "Time log not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # Get location history
        history = EmployeeLocation.objects.filter(time_log=log).order_by('timestamp')
        history_data = EmployeeLocationSerializer(history, many=True, context={'request': request}).data
        
        # Get shift photos
        photos = []
        for p in log.photos.all():
            photos.append({
                "id": str(p.id),
                "url": request.build_absolute_uri(p.photo.url) if p.photo else None,
                "type": p.photo_type,
                "caption": p.caption,
                "uploaded_at": p.uploaded_at
            })

        # Clock in photo
        clock_in_photo = request.build_absolute_uri(log.clock_in_photo.url) if log.clock_in_photo else None

        data = {
            "id": str(log.id),
            "employee_name": log.employee.user.get_full_name() or log.employee.user.username,
            "employee_id_code": log.employee.employee_id,
            "clock_in": log.clock_in,
            "clock_out": log.clock_out,
            "clock_in_photo": clock_in_photo,
            "clock_in_address": log.clock_in_address,
            "clock_in_notes": log.clock_in_notes,
            "worked_seconds": log.worked_seconds() if log.clock_out else int((timezone.now() - log.clock_in).total_seconds()),
            "job_site_name": log.employee.assigned_job_site.name if log.employee.assigned_job_site else "Corporate",
            "photos": photos,
            "history": history_data
        }
        
        return Response(data)
