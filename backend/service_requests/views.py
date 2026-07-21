"""
service_requests/views.py

Three groups of views:
  1. Public  — no auth (booking + feedback token)
  2. Admin   — IsAdminRole
  3. Employee — IsEmployeeRole

Business logic is NEVER inline — always delegated to state_machine.apply_transition()
or service-layer helpers. Views are thin: validate → call service → return response.
"""
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole, IsEmployeeRole, is_admin_role
from employees.models import Employee

from .models import (
    EmployeeJob, EmployeePerformance,
    JobCompletionProof, ServiceFeedback, ServiceRequest,
)
from .serializers import (
    AdminAssignSerializer, AdminChangePrioritySerializer,
    EmployeeJobDetailSerializer, EmployeeJobListSerializer,
    EmployeeJobNotesSerializer, EmployeePerformanceSerializer,
    FeedbackTokenSummarySerializer, JobProofUploadSerializer,
    ServiceFeedbackAdminSerializer, ServiceFeedbackSubmitSerializer,
    ServiceRequestDetailSerializer, ServiceRequestListSerializer,
    ServiceRequestPublicCreateSerializer,
)
from .state_machine import apply_transition


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _success(data=None, message="", status_code=200):
    return Response(
        {"success": True, "data": data if data is not None else {}, "message": message},
        status=status_code,
    )


def _error(message, status_code=400):
    return Response(
        {"success": False, "message": message},
        status=status_code,
    )


def _get_company(request):
    """Return company from request if available (postgres/tenant), else None (sqlite/dev)."""
    return getattr(request, "company", None)


def _sr_qs(request):
    """Scoped ServiceRequest queryset — company-scoped if available."""
    company = _get_company(request)
    qs = ServiceRequest.objects.select_related("assigned_employee", "assigned_employee__user")
    if company:
        qs = qs.filter(company=company)
    return qs


# ─── 1. PUBLIC VIEWS ──────────────────────────────────────────────────────────

class CatalogCategoryListView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        from .models import CatalogCategory
        from .serializers import CatalogCategorySerializer
        cats = CatalogCategory.objects.all().order_by('name')
        data = CatalogCategorySerializer(cats, many=True).data
        return Response({"success": True, "data": data})

class CatalogServiceListView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        from .models import CatalogService
        from .serializers import CatalogServiceSerializer
        from django.db import connection
        cat_id = request.GET.get('category_id')
        qs = CatalogService.objects.all().order_by('name')
        if cat_id:
            qs = qs.filter(category_id=cat_id)
        data = CatalogServiceSerializer(qs, many=True).data
        
        # Determine currency from company tenant region
        tenant = getattr(request, 'tenant', None) or getattr(connection, 'tenant', None)
        currency = "USD"
        currency_symbol = "$"
        if tenant and getattr(tenant, 'region', None):
            currency = tenant.region.currency
            currency_symbol = tenant.region.currency_symbol
            
        return Response({
            "success": True, 
            "data": data,
            "currency": currency,
            "currency_symbol": currency_symbol
        })

class BookingCreateView(APIView):
    """
    POST /api/booking/
    Public — no authentication required.
    Creates a ServiceRequest and returns the human-readable request_id.
    COD:    status=confirmed, payment_status=pending
    Online: status=waiting_for_payment, payment_status=processing
    """
    permission_classes = [permissions.AllowAny]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = ServiceRequestPublicCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Validation error.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        company = _get_company(request)

        # Determine payment method and set initial statuses
        payment_method = (request.data.get("payment_method") or "COD").upper()
        if payment_method == "ONLINE":
            initial_status = ServiceRequest.Status.WAITING_FOR_PAYMENT
            initial_payment_status = ServiceRequest.PaymentStatus.PROCESSING
        else:
            payment_method = "COD"
            initial_status = ServiceRequest.Status.CONFIRMED
            initial_payment_status = ServiceRequest.PaymentStatus.PENDING

        # Link authenticated customer if logged in
        if request.user and request.user.is_authenticated and hasattr(request.user, 'role') and request.user.role == 'customer':
            user = request.user
            customer_name = request.data.get("customer_name", "")
            email = request.data.get("email", "")
            phone = request.data.get("phone", "")

            sr = serializer.save(
                company=company,
                customer=user,
                status=initial_status,
                payment_method=payment_method,
                payment_status=initial_payment_status,
            )

            # Sync name
            if customer_name and not user.first_name and not user.last_name:
                parts = customer_name.strip().split(" ")
                user.first_name = parts[0]
                user.last_name = " ".join(parts[1:]) if len(parts) > 1 else ""

            # Sync email and merge profiles if duplicates exist
            from django.contrib.auth import get_user_model
            User = get_user_model()

            email_clean = email.lower().strip() if email else ""
            if email_clean and not user.email:
                other_user = User.objects.filter(email__iexact=email_clean, role=User.Role.CUSTOMER).exclude(pk=user.pk).first()
                if other_user:
                    other_user.service_requests_as_customer.all().update(customer=user)
                    if other_user.phone and not user.phone:
                        user.phone = other_user.phone
                    other_user.delete()
                user.email = email_clean

            # Sync phone and merge profiles if duplicates exist
            phone_clean = phone.strip() if phone else ""
            if phone_clean and not user.phone:
                other_user = User.objects.filter(phone=phone_clean, role=User.Role.CUSTOMER).exclude(pk=user.pk).first()
                if other_user:
                    other_user.service_requests_as_customer.all().update(customer=user)
                    if other_user.email and not user.email:
                        user.email = other_user.email
                    other_user.delete()
                user.phone = phone_clean

            user.save()
        else:
            sr = serializer.save(
                company=company,
                status=initial_status,
                payment_method=payment_method,
                payment_status=initial_payment_status,
            )

        # Send booking confirmation email
        try:
            from .notifications import send_booking_confirmation
            send_booking_confirmation(sr)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to send booking confirmation email: {e}")

        return _success(
            data={
                "request_id": sr.request_id,
                "id": sr.id,
                "payment_method": sr.payment_method,
                "payment_status": sr.payment_status,
                "booking_status": sr.status,
                "total_amount": float(sr.total_amount),
            },
            message="Your service request has been submitted successfully.",
            status_code=201,
        )


class CustomerMyBookingsView(APIView):
    """
    GET /api/booking/my-bookings/
    Authenticated customers can view their past bookings.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'role') or request.user.role != 'customer':
            return _error("Only customers can view their bookings.", 403)
        
        company = _get_company(request)
        qs = ServiceRequest.objects.filter(customer=request.user).select_related('assigned_employee', 'assigned_employee__user')
        if company:
            qs = qs.filter(company=company)
        
        qs = qs.order_by("-id")
        serializer = ServiceRequestListSerializer(qs, many=True)
        return _success(data=serializer.data)


class FeedbackTokenView(APIView):
    """
    GET  /api/feedback/<token>/  → return SR summary for the feedback form
    POST /api/feedback/<token>/  → submit customer feedback
    Both public — no auth.
    """
    permission_classes = [permissions.AllowAny]

    def _get_feedback(self, token):
        try:
            return ServiceFeedback.objects.select_related("service_request").get(
                feedback_token=token
            )
        except ServiceFeedback.DoesNotExist:
            return None

    def get(self, request, token):
        feedback = self._get_feedback(token)
        if not feedback:
            return _error("Feedback link not found or has expired.", 404)
        if feedback.is_submitted:
            return _error("Feedback has already been submitted for this request.", 410)

        sr_data = FeedbackTokenSummarySerializer(feedback.service_request).data
        return _success(data=sr_data)

    def post(self, request, token):
        feedback = self._get_feedback(token)
        if not feedback:
            return _error("Feedback link not found or has expired.", 404)
        if feedback.is_submitted:
            return _error("Feedback has already been submitted.", 410)

        serializer = ServiceFeedbackSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for attr, value in serializer.validated_data.items():
                setattr(feedback, attr, value)
            feedback.submitted_at = timezone.now()
            feedback.is_submitted = True
            feedback.save()

            sr = feedback.service_request
            apply_transition(sr, ServiceRequest.Status.FEEDBACK_RECEIVED)
            sr.save(update_fields=["status", "updated_at"])

        return _success(message="Thank you for your feedback!")


# ─── 2. ADMIN VIEWS ───────────────────────────────────────────────────────────

class AdminSRListView(APIView):
    """
    GET /api/admin/service-requests/
    List all service requests. Filters: status, priority, service_category, search.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs = _sr_qs(request).order_by("-created_at")

        # Filters
        s = request.query_params.get("status")
        p = request.query_params.get("priority")
        c = request.query_params.get("category")
        q = request.query_params.get("search")

        if s:
            qs = qs.filter(status=s)
        if p:
            qs = qs.filter(priority=p)
        if c:
            qs = qs.filter(service_category=c)
        if q:
            qs = qs.filter(customer_name__icontains=q) | qs.filter(request_id__icontains=q) | qs.filter(issue_title__icontains=q)

        serializer = ServiceRequestListSerializer(qs, many=True, context={"request": request})
        return _success(data=serializer.data)


class AdminSRDetailView(APIView):
    """GET /api/admin/service-requests/<id>/"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request, pk):
        try:
            sr = _sr_qs(request).get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Service request not found.", 404)
        serializer = ServiceRequestDetailSerializer(sr, context={"request": request})
        return _success(data=serializer.data)


class AdminSRReviewView(APIView):
    """PATCH /api/admin/service-requests/<id>/review/ → New Request → Reviewed"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        try:
            sr = _sr_qs(request).get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Not found.", 404)
        apply_transition(sr, ServiceRequest.Status.REVIEWED, actor=request.user)
        sr.save(update_fields=["status", "updated_at"])
        return _success(
            data=ServiceRequestDetailSerializer(sr, context={"request": request}).data,
            message="Request marked as Reviewed.",
        )


class AdminSRPriorityView(APIView):
    """PATCH /api/admin/service-requests/<id>/priority/ → change priority"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        try:
            sr = _sr_qs(request).get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Not found.", 404)
        serializer = AdminChangePrioritySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=400)
        sr.priority = serializer.validated_data["priority"]
        sr.save(update_fields=["priority", "updated_at"])
        return _success(message=f"Priority updated to {sr.get_priority_display()}.")


class AdminSRAssignView(APIView):
    """PATCH /api/admin/service-requests/<id>/assign/ → Reviewed → Assigned, creates EmployeeJob"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        try:
            sr = _sr_qs(request).get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Not found.", 404)

        serializer = AdminAssignSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=400)

        employee = Employee.objects.get(id=serializer.validated_data["employee_id"])

        with transaction.atomic():
            apply_transition(sr, ServiceRequest.Status.ASSIGNED, actor=request.user)
            sr.assigned_employee = employee
            sr.save(update_fields=["status", "assigned_employee", "updated_at"])

            # Create or update EmployeeJob
            job, _ = EmployeeJob.objects.update_or_create(
                service_request=sr,
                defaults={
                    "employee": employee,
                    "assigned_by": request.user,
                    "status": EmployeeJob.Status.ASSIGNED,
                    "assigned_date": timezone.now(),
                },
            )

        return _success(
            data=ServiceRequestDetailSerializer(sr, context={"request": request}).data,
            message=f"Assigned to {employee.user.get_full_name() or employee.user.username}.",
        )


class AdminSRRejectView(APIView):
    """PATCH /api/admin/service-requests/<id>/reject/ → Rejected"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        try:
            sr = _sr_qs(request).get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Not found.", 404)
        apply_transition(sr, ServiceRequest.Status.REJECTED, actor=request.user)
        sr.save(update_fields=["status", "updated_at"])
        return _success(message="Request rejected.")


class AdminSRVerifyView(APIView):
    """
    PATCH /api/admin/service-requests/<id>/verify/
    Awaiting Verification → Verified → Feedback Pending (in one transaction).
    Creates ServiceFeedback record with token and sends feedback link.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        try:
            sr = _sr_qs(request).get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Not found.", 404)

        with transaction.atomic():
            # Step 1: Awaiting Verification → Verified
            apply_transition(sr, ServiceRequest.Status.VERIFIED, actor=request.user)
            sr.save(update_fields=["status", "updated_at"])

            # Step 2: Verified → Feedback Pending
            apply_transition(sr, ServiceRequest.Status.FEEDBACK_PENDING, actor=request.user)
            sr.save(update_fields=["status", "updated_at"])

            # Create ServiceFeedback record (token generated on creation)
            feedback, _ = ServiceFeedback.objects.get_or_create(service_request=sr)

        # Send feedback link outside transaction (never blocks on email failure)
        from .notifications import send_feedback_link
        send_feedback_link(sr, str(feedback.feedback_token))

        return _success(
            data={
                "feedback_token": str(feedback.feedback_token),
                **ServiceRequestDetailSerializer(sr, context={"request": request}).data,
            },
            message="Verified. Feedback link sent to customer.",
        )


class AdminSRReworkView(APIView):
    """PATCH /api/admin/service-requests/<id>/request-rework/ → Rework Requested → In Progress"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        try:
            sr = _sr_qs(request).get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Not found.", 404)

        with transaction.atomic():
            apply_transition(sr, ServiceRequest.Status.REWORK_REQUESTED, actor=request.user)
            sr.save(update_fields=["status", "updated_at"])

            apply_transition(sr, ServiceRequest.Status.IN_PROGRESS, actor=request.user)
            sr.save(update_fields=["status", "updated_at"])

            # Reset job status to in_progress
            try:
                job = sr.employee_job
                job.status = EmployeeJob.Status.IN_PROGRESS
                job.save(update_fields=["status"])
            except EmployeeJob.DoesNotExist:
                pass

        return _success(
            data=ServiceRequestDetailSerializer(sr, context={"request": request}).data,
            message="Rework requested. Job sent back to In Progress.",
        )


class AdminSRResendFeedbackView(APIView):
    """POST /api/admin/service-requests/<id>/resend-feedback/ → send or resend feedback link"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        try:
            sr = _sr_qs(request).get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Not found.", 404)

        exclude_statuses = [
            ServiceRequest.Status.CLOSED,
            ServiceRequest.Status.REJECTED,
            ServiceRequest.Status.FEEDBACK_RECEIVED
        ]
        if sr.status in exclude_statuses:
            return _error("Cannot send feedback link for closed, rejected, or feedback-submitted requests.", 400)

        # Create or get ServiceFeedback record
        feedback, _ = ServiceFeedback.objects.get_or_create(service_request=sr)

        # Send feedback link
        from .notifications import send_feedback_link
        try:
            send_feedback_link(sr, str(feedback.feedback_token))
            return _success(message="Feedback link email sent successfully.")
        except Exception as e:
            return _error(f"Failed to send feedback email: {e}", 500)


class AdminSRCloseView(APIView):
    """PATCH /api/admin/service-requests/<id>/close/ → Feedback Received → Closed"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        try:
            sr = _sr_qs(request).get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Not found.", 404)
        apply_transition(sr, ServiceRequest.Status.CLOSED, actor=request.user)
        sr.save(update_fields=["status", "updated_at"])
        return _success(message="Service request closed.")


class AdminFeedbackListView(APIView):
    """GET /api/admin/feedback/ — list all submitted feedback"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        from django.db.models import Q
        company = _get_company(request)
        qs = ServiceFeedback.objects.filter(is_submitted=True).select_related(
            "service_request",
            "service_request__employee_job__employee__user",
            "service_request__assigned_employee__user"
        ).order_by("-submitted_at")

        if company:
            qs = qs.filter(service_request__company=company)

        # Filters
        rating = request.query_params.get("rating")
        emp_id = request.query_params.get("employee_id")
        date_from = request.query_params.get("date_from")
        date_to   = request.query_params.get("date_to")

        if rating:
            qs = qs.filter(rating=rating)
        if emp_id:
            qs = qs.filter(
                Q(service_request__assigned_employee_id=emp_id) |
                Q(service_request__employee_job__employee_id=emp_id)
            )
        if date_from:
            qs = qs.filter(submitted_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(submitted_at__date__lte=date_to)

        serializer = ServiceFeedbackAdminSerializer(qs, many=True)
        return _success(data=serializer.data)


class AdminFeedbackMetricsView(APIView):
    """GET /api/admin/feedback/metrics/ — aggregate metrics"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        from django.db.models import Avg, Count, Q
        company = _get_company(request)
        qs = ServiceFeedback.objects.filter(is_submitted=True)
        if company:
            qs = qs.filter(service_request__company=company)

        # Filters
        rating = request.query_params.get("rating")
        emp_id = request.query_params.get("employee_id")
        date_from = request.query_params.get("date_from")
        date_to   = request.query_params.get("date_to")

        if rating:
            qs = qs.filter(rating=rating)
        if emp_id:
            qs = qs.filter(
                Q(service_request__assigned_employee_id=emp_id) |
                Q(service_request__employee_job__employee_id=emp_id)
            )
        if date_from:
            qs = qs.filter(submitted_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(submitted_at__date__lte=date_to)

        agg = qs.aggregate(
            total=Count("id"),
            avg_rating=Avg("rating"),
            resolved=Count("id", filter=Q(issue_resolved=True)),
        )

        total    = agg["total"] or 0
        resolved = agg["resolved"] or 0
        return _success(data={
            "total_feedback":        total,
            "average_rating":        round(agg["avg_rating"] or 0, 2),
            "issue_resolution_rate": round((resolved / total * 100) if total else 0, 2),
        })


class AdminEmployeeListView(APIView):
    """GET /api/admin/service-requests/employees/ — list all employees for assignment picker"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        company = _get_company(request)
        qs = Employee.objects.select_related("user").filter(is_active=True)
        if company:
            qs = qs.filter(company=company)
        data = [
            {
                "id": e.id,
                "employee_id": e.employee_id,
                "full_name": e.user.get_full_name() or e.user.username,
                "title": e.title,
                "email": e.user.email,
                "hourly_rate": float(e.hourly_rate) if e.hourly_rate is not None else 0.0,
                "department": e.department,
                "service_roles": e.service_roles,
            }
            for e in qs
        ]
        return _success(data=data)


# ─── 3. EMPLOYEE VIEWS ────────────────────────────────────────────────────────

def _get_employee(request):
    """Return Employee for the authenticated user, or None."""
    company = _get_company(request)
    qs = Employee.objects.filter(user=request.user)
    if company:
        qs = qs.filter(company=company)
    return qs.first()


def _emp_job_qs(request):
    employee = _get_employee(request)
    if not employee:
        return EmployeeJob.objects.none()
    return EmployeeJob.objects.filter(employee=employee).select_related(
        "service_request", "service_request__assigned_employee",
    ).prefetch_related("proofs")


class EmployeeJobListView(APIView):
    """GET /api/employee/jobs/ — jobs for logged-in employee"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = _emp_job_qs(request)
        s = request.query_params.get("status")
        if s:
            qs = qs.filter(status=s)
        serializer = EmployeeJobListSerializer(qs, many=True, context={"request": request})
        return _success(data=serializer.data)


class EmployeeJobDetailView(APIView):
    """GET /api/employee/jobs/<id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            job = _emp_job_qs(request).get(pk=pk)
        except EmployeeJob.DoesNotExist:
            return _error("Job not found.", 404)
        return _success(data=EmployeeJobDetailSerializer(job, context={"request": request}).data)


class EmployeeJobAcceptView(APIView):
    """PATCH /api/employee/jobs/<id>/accept/ → Assigned → Accepted"""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            job = _emp_job_qs(request).get(pk=pk)
        except EmployeeJob.DoesNotExist:
            return _error("Job not found.", 404)

        with transaction.atomic():
            apply_transition(job.service_request, ServiceRequest.Status.ACCEPTED)
            job.service_request.save(update_fields=["status", "updated_at"])
            job.status = EmployeeJob.Status.ACCEPTED
            job.accepted_date = timezone.now()
            job.save(update_fields=["status", "accepted_date"])

        return _success(message="Job accepted.")


class EmployeeJobRejectView(APIView):
    """PATCH /api/employee/jobs/<id>/reject/ → unassign, notify admin"""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            job = _emp_job_qs(request).get(pk=pk)
        except EmployeeJob.DoesNotExist:
            return _error("Job not found.", 404)

        if job.status not in [EmployeeJob.Status.ASSIGNED]:
            return _error("You can only reject a job in Assigned status.")

        with transaction.atomic():
            job.status = EmployeeJob.Status.REJECTED
            job.save(update_fields=["status"])
            # Move SR back to Reviewed so admin can re-assign
            sr = job.service_request
            sr.status = ServiceRequest.Status.REVIEWED
            sr.assigned_employee = None
            sr.save(update_fields=["status", "assigned_employee", "updated_at"])

        return _success(message="Job rejected. Admin has been notified.")


class EmployeeJobStartView(APIView):
    """PATCH /api/employee/jobs/<id>/start/ → Accepted → In Progress"""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            job = _emp_job_qs(request).get(pk=pk)
        except EmployeeJob.DoesNotExist:
            return _error("Job not found.", 404)

        with transaction.atomic():
            apply_transition(job.service_request, ServiceRequest.Status.IN_PROGRESS)
            job.service_request.save(update_fields=["status", "updated_at"])
            job.status = EmployeeJob.Status.IN_PROGRESS
            job.started_date = timezone.now()
            job.save(update_fields=["status", "started_date"])

        return _success(message="Work started.")


class EmployeeJobCompleteView(APIView):
    """
    PATCH /api/employee/jobs/<id>/complete/ → In Progress → Completed
    Requires at least one proof uploaded before completion is allowed.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            job = _emp_job_qs(request).get(pk=pk)
        except EmployeeJob.DoesNotExist:
            return _error("Job not found.", 404)

        if not job.proofs.exists():
            return _error(
                "Please upload at least one completion photo or document before marking as Complete.",
                400,
            )

        with transaction.atomic():
            sr = job.service_request
            # Step through any intermediate states gracefully (handles any starting status)
            S = ServiceRequest.Status
            COMPLETION_PATH = [
                S.ACCEPTED,
                S.IN_PROGRESS,
                S.COMPLETED,
                S.AWAITING_VERIFICATION,
                S.VERIFIED,
                S.FEEDBACK_PENDING,
            ]
            from service_requests.state_machine import ALLOWED_TRANSITIONS
            # Keep stepping through states until we reach FEEDBACK_PENDING
            # This handles any starting status (CONFIRMED, ASSIGNED, IN_PROGRESS, etc.)
            max_steps = 10  # safety guard against infinite loops
            while sr.status != S.FEEDBACK_PENDING and max_steps > 0:
                max_steps -= 1
                allowed = ALLOWED_TRANSITIONS.get(sr.status, set())
                # Find the next step along the COMPLETION_PATH
                next_step = None
                for candidate in COMPLETION_PATH:
                    if candidate in allowed:
                        next_step = candidate
                        break
                if next_step is None:
                    break  # no valid transition found — stop
                apply_transition(sr, next_step)

            sr.save(update_fields=["status", "updated_at"])

            job.status = EmployeeJob.Status.COMPLETED
            job.completed_date = timezone.now()
            job.save(update_fields=["status", "completed_date"])

            # Create feedback model record (generates token)
            feedback, _ = ServiceFeedback.objects.get_or_create(service_request=sr)

        # Send single combined completion+feedback email outside the transaction
        import logging
        logger = logging.getLogger(__name__)
        try:
            from .notifications import send_completion_and_feedback_email
            send_completion_and_feedback_email(sr, str(feedback.feedback_token))
        except Exception as e:
            logger.error(f"Failed to send completion+feedback email: {e}")

        return _success(message="Work marked as Complete. Feedback request sent to customer.")


class EmployeeJobProofView(APIView):
    """
    POST /api/employee/jobs/<id>/proof/
    Upload photo/doc/note → if job is Completed, transitions SR to Awaiting Verification.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        try:
            job = _emp_job_qs(request).get(pk=pk)
        except EmployeeJob.DoesNotExist:
            return _error("Job not found.", 404)

        serializer = JobProofUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=400)

        with transaction.atomic():
            proof = serializer.save(job=job)

            # If job is completed, push SR to Awaiting Verification
            if job.status == EmployeeJob.Status.COMPLETED:
                sr = job.service_request
                if sr.status == ServiceRequest.Status.COMPLETED:
                    apply_transition(sr, ServiceRequest.Status.AWAITING_VERIFICATION)
                    sr.save(update_fields=["status", "updated_at"])

        return _success(
            data={"proof_id": proof.id},
            message="Proof uploaded successfully.",
            status_code=201,
        )


class EmployeePerformanceView(APIView):
    """GET /api/employee/performance/ — own performance stats + feedback history"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        employee = _get_employee(request)
        if not employee:
            return _error("Employee profile not found.", 404)

        from .signals import recalculate_employee_performance
        perf = recalculate_employee_performance(employee)

        serializer = EmployeePerformanceSerializer(perf)
        return _success(data=serializer.data)


class PublicFeedbackListView(APIView):
    """GET /api/public/feedback/ — fetch recent public feedback for catalog/booking display"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        category_slug = request.query_params.get("category")
        
        qs = ServiceFeedback.objects.filter(is_submitted=True).select_related("service_request")
        
        # Filter by category if provided, checking the catalog slug or exact text match
        if category_slug:
            # ServiceCategory is a string in ServiceRequest (often the catalog category ID or name).
            # But the simplest is to match the category name roughly if it's stored as text,
            # or try to match if service_category matches the slug/id. 
            # In our db, service_category stores the category ID from the catalog.
            qs = qs.filter(service_request__service_category=category_slug)
            
        # Get top 15 most recent
        feedbacks = qs.order_by("-submitted_at")[:15]
        
        data = []
        for f in feedbacks:
            # Mask the name (e.g. "John D.")
            full_name = f.service_request.customer_name or "Customer"
            parts = full_name.split()
            if len(parts) > 1:
                display_name = f"{parts[0]} {parts[1][0]}."
            else:
                display_name = full_name
                
            data.append({
                "name": display_name,
                "rating": f.rating,
                "text": f.comment or ("Great service!" if f.rating >= 4 else "Service completed."),
                "submitted_at": f.submitted_at.isoformat() if f.submitted_at else None,
                "category": f.service_request.service_category
            })
            
        return _success(data=data)
