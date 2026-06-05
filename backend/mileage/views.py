from datetime import datetime
from decimal import Decimal

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdminRole
from employees.models import Employee
from .models import MileagePolicy, MileageTrip, MileageYTDTracker
from .serializers import (
    MileagePolicySerializer,
    MileageTripSerializer,
    MileageYTDTrackerSerializer,
)
from .services import (
    calculate_trip_reimbursement,
    create_travel_timelog,
    create_trip_from_task_sequence,
    create_trip_from_transfer,
    get_ytd_miles,
    inject_mileage_into_payroll,
    preview_trip_reimbursement,
)


class MileagePolicyViewSet(viewsets.ModelViewSet):
    serializer_class = MileagePolicySerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdminRole()]

    def get_queryset(self):
        return MileagePolicy.objects.filter(company=self.request.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.company)


class MileageTripViewSet(viewsets.ModelViewSet):
    serializer_class = MileageTripSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = MileageTrip.objects.filter(company=self.request.company)
        user = self.request.user

        # Non-admins can only see their own trips
        if user.role not in ["admin", "manager"]:
            qs = qs.filter(employee__user=user)

        # Filtering query parameters
        employee_id = self.request.query_params.get("employee_id")
        approval_status = self.request.query_params.get("approval_status")
        jurisdiction = self.request.query_params.get("jurisdiction")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")

        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if approval_status:
            qs = qs.filter(approval_status=approval_status)
        if jurisdiction:
            qs = qs.filter(jurisdiction=jurisdiction)
        if start_date:
            qs = qs.filter(trip_date__gte=start_date)
        if end_date:
            qs = qs.filter(trip_date__lte=end_date)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        employee_id = self.request.data.get("employee")

        if user.role in ["admin", "manager"] and employee_id:
            # Admins can specify employee
            employee = Employee.objects.get(pk=employee_id, company=self.request.company)
        else:
            # Fallback to current user's employee profile
            employee = Employee.objects.get(user=user, company=self.request.company)

        # Default jurisdiction to employee country code if not set
        jurisdiction = self.request.data.get("jurisdiction")
        if not jurisdiction:
            jurisdiction = employee.country or "US"
            # Map country codes to enum
            if jurisdiction not in [choice[0] for choice in MileageTrip.Jurisdiction.choices]:
                jurisdiction = "US"

        trip = serializer.save(
            company=self.request.company,
            employee=employee,
            jurisdiction=jurisdiction,
        )

        # Run reimbursement calculation on create
        calculate_trip_reimbursement(trip.pk, self.request.company.pk)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdminRole])
    def approve(self, request, pk=None):
        trip = self.get_object()
        trip.approval_status = MileageTrip.ApprovalStatus.APPROVED
        trip.approved_by = request.user
        trip.approved_at = timezone.now()
        trip.rejection_reason = ""
        trip.save()

        # Try to automatically generate a travel timelog for the trip duration
        create_travel_timelog(trip.pk, request.company.pk)

        serializer = self.get_serializer(trip)
        return Response({"success": True, "data": serializer.data})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdminRole])
    def reject(self, request, pk=None):
        trip = self.get_object()
        reason = request.data.get("reason", "")
        trip.approval_status = MileageTrip.ApprovalStatus.REJECTED
        trip.approved_by = None
        trip.approved_at = None
        trip.rejection_reason = reason
        trip.save()

        serializer = self.get_serializer(trip)
        return Response({"success": True, "data": serializer.data})

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        trip = self.get_object()
        calculate_trip_reimbursement(trip.pk, request.company.pk)
        trip.refresh_from_db()
        serializer = self.get_serializer(trip)
        return Response({"success": True, "data": serializer.data})

    @action(detail=False, methods=["post"])
    def preview(self, request):
        """
        Preview a trip reimbursement amount without saving.
        """
        distance_miles = request.data.get("distance_miles", 0)
        distance_km = request.data.get("distance_km", 0)
        jurisdiction = request.data.get("jurisdiction", "US")
        trip_date_str = request.data.get("trip_date")
        employee_id = request.data.get("employee_id")

        if trip_date_str:
            try:
                trip_date = datetime.strptime(trip_date_str, "%Y-%m-%d").date()
            except ValueError:
                trip_date = timezone.localdate()
        else:
            trip_date = timezone.localdate()

        if not employee_id:
            try:
                employee = Employee.objects.get(user=request.user, company=request.company)
                employee_id = employee.pk
            except Employee.DoesNotExist:
                return Response(
                    {"detail": "Employee profile required for calculation"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        result = preview_trip_reimbursement(
            employee_id=employee_id,
            company=request.company,
            distance_miles=Decimal(str(distance_miles)),
            distance_km=Decimal(str(distance_km)),
            jurisdiction=jurisdiction,
            trip_date=trip_date,
        )
        return Response({"success": True, "data": result})

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdminRole])
    def create_from_tasks(self, request):
        employee_id = request.data.get("employee_id")
        task_ids = request.data.get("task_ids", [])

        if not employee_id or not task_ids:
            return Response(
                {"detail": "employee_id and task_ids are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            created_ids = create_trip_from_task_sequence(
                employee_id=employee_id,
                task_ids=task_ids,
                company_id=request.company.pk,
            )
            return Response({"success": True, "created_trip_ids": created_ids})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdminRole])
    def create_from_transfer(self, request):
        transfer_id = request.data.get("transfer_id")
        employee_id = request.data.get("employee_id")

        if not transfer_id or not employee_id:
            return Response(
                {"detail": "transfer_id and employee_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            trip_id = create_trip_from_transfer(
                transfer_id=transfer_id,
                company_id=request.company.pk,
                employee_id=employee_id,
            )
            if trip_id:
                return Response({"success": True, "created_trip_id": trip_id})
            return Response(
                {"detail": "Could not create trip. Missing coordinates on inventory transfer locations."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdminRole])
    def inject_payroll(self, request):
        payroll_record_id = request.data.get("payroll_record_id")
        start_date_str = request.data.get("period_start")
        end_date_str = request.data.get("period_end")

        if not payroll_record_id or not start_date_str or not end_date_str:
            return Response(
                {"detail": "payroll_record_id, period_start, and period_end are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            period_start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            period_end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            result = inject_mileage_into_payroll(
                payroll_record_id=payroll_record_id,
                company_id=request.company.pk,
                period_start=period_start,
                period_end=period_end,
            )
            return Response({"success": True, "data": result})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def fetch_gps_travel(self, request):
        """
        Fetch GPS travel details for current employee on a specific date.
        Query params:
          date: YYYY-MM-DD
        """
        date_str = request.query_params.get("date")
        if not date_str:
            return Response({"detail": "date query parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)

        # Resolve employee profile
        try:
            employee = Employee.objects.get(user=request.user, company=request.company)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee profile not found"}, status=status.HTTP_404_NOT_FOUND)

        # Import location models
        from live_locations.models import EmployeeLocation
        from .services import _haversine_km, _km_to_miles

        pings = list(
            EmployeeLocation.objects.filter(
                employee=employee,
                timestamp__date=target_date
            ).order_by("timestamp")
        )

        if not pings:
            return Response({
                "found": False,
                "distance_km": 0.0,
                "distance_miles": 0.0,
                "from_location": "",
                "to_location": "",
                "message": "No GPS pings recorded for this date."
            })

        # Calculate sequential distance
        total_km = Decimal("0.0")
        for i in range(len(pings) - 1):
            p1 = pings[i]
            p2 = pings[i + 1]
            total_km += _haversine_km(float(p1.lat), float(p1.lng), float(p2.lat), float(p2.lng))

        total_miles = _km_to_miles(total_km)

        # Resolve from and to locations
        from_lat, from_lng = float(pings[0].lat), float(pings[0].lng)
        to_lat, to_lng = float(pings[-1].lat), float(pings[-1].lng)

        def find_nearest_site(lat, lng, company):
            from time_tracking.models import Location, JobSite
            nearest_name = None
            min_dist = float('inf')
            # Check saved locations
            for loc in Location.objects.filter(company=company, is_active=True, is_archived=False):
                dist = float(_haversine_km(lat, lng, loc.lat, loc.lng))
                if dist < min_dist and dist < 0.5: # 500m
                    min_dist = dist
                    nearest_name = loc.name
            # Check legacy JobSites
            for site in JobSite.objects.filter(company=company):
                dist = float(_haversine_km(lat, lng, float(site.lat), float(site.lng)))
                if dist < min_dist and dist < 0.5:
                    min_dist = dist
                    nearest_name = site.name
            if nearest_name:
                return nearest_name
            return f"{round(lat, 5)}, {round(lng, 5)}"

        from_location = find_nearest_site(from_lat, from_lng, request.company)
        to_location = find_nearest_site(to_lat, to_lng, request.company)

        return Response({
            "found": True,
            "distance_km": float(round(total_km, 2)),
            "distance_miles": float(round(total_miles, 2)),
            "from_location": from_location,
            "to_location": to_location,
            "message": f"Successfully fetched GPS travel history: {len(pings)} pings found."
        })


class MileageYTDTrackerViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MileageYTDTrackerSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = MileageYTDTracker.objects.filter(company=self.request.company)
        user = self.request.user

        if user.role not in ["admin", "manager"]:
            qs = qs.filter(employee__user=user)

        employee_id = self.request.query_params.get("employee_id")
        jurisdiction = self.request.query_params.get("jurisdiction")
        tax_year = self.request.query_params.get("tax_year")

        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if jurisdiction:
            qs = qs.filter(jurisdiction=jurisdiction)
        if tax_year:
            qs = qs.filter(tax_year=tax_year)

        return qs

    @action(detail=False, methods=["get"])
    def summary(self, request):
        employee_id = request.query_params.get("employee_id")
        jurisdiction = request.query_params.get("jurisdiction", "US")

        if not employee_id:
            try:
                employee = Employee.objects.get(user=request.user, company=request.company)
                employee_id = employee.pk
            except Employee.DoesNotExist:
                return Response(
                    {"detail": "Employee profile required for summary"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            result = get_ytd_miles(
                employee_id=employee_id,
                company_id=request.company.pk,
                jurisdiction=jurisdiction,
            )
            return Response({"success": True, "data": result})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
