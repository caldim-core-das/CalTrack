"""
service_requests/payment_views.py

Payment-specific API views:
  - Mock payment initiation / verification (simulates Razorpay flow)
  - Employee cash collection for COD bookings
  - Invoice PDF generation
  - On-the-way and work-start employee status updates
"""
import hashlib
import hmac
import logging
import os
import uuid
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsEmployeeRole
from .models import EmployeeJob, ServiceRequest
from .serializers import ServiceRequestDetailSerializer

logger = logging.getLogger(__name__)


def _success(data=None, message="", status_code=200):
    return Response(
        {"success": True, "data": data if data is not None else {}, "message": message},
        status=status_code,
    )


def _error(message, status_code=400):
    return Response({"success": False, "message": message}, status=status_code)


# ─── Mock Payment Flow ────────────────────────────────────────────────────────

class PaymentInitiateView(APIView):
    """
    POST /api/payment/initiate/
    Creates a mock payment order for the given booking.
    In production: Replace with Razorpay order creation.
    Returns a mock order_id that the frontend uses to present payment UI.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        booking_id = request.data.get("booking_id")
        if not booking_id:
            return _error("booking_id is required.")

        try:
            sr = ServiceRequest.objects.get(pk=booking_id)
        except ServiceRequest.DoesNotExist:
            return _error("Booking not found.", 404)

        if sr.payment_method != ServiceRequest.PaymentMethod.ONLINE:
            return _error("This booking does not require online payment.")

        if sr.payment_status == ServiceRequest.PaymentStatus.PAID:
            return _error("This booking is already paid.")

        # Generate a mock order ID (replace with real Razorpay in production)
        mock_order_id = f"order_mock_{uuid.uuid4().hex[:16]}"

        return _success(
            data={
                "order_id": mock_order_id,
                "amount": float(sr.total_amount),
                "currency": "INR",
                "booking_id": sr.id,
                "request_id": sr.request_id,
                "customer_name": sr.customer_name,
                "customer_email": sr.email or "",
                "customer_phone": sr.phone or "",
                "description": f"Payment for {sr.issue_title}",
            },
            message="Payment order created.",
        )


class PaymentVerifyView(APIView):
    """
    POST /api/payment/verify/
    Verifies a completed payment (mock: trust the client; real: verify Razorpay signature).
    On success: updates booking status to Confirmed, payment_status to Paid.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        booking_id   = request.data.get("booking_id")
        order_id     = request.data.get("order_id")
        payment_id   = request.data.get("payment_id")
        mock_success = request.data.get("mock_success", True)

        if not booking_id:
            return _error("booking_id is required.")

        try:
            sr = ServiceRequest.objects.get(pk=booking_id)
        except ServiceRequest.DoesNotExist:
            return _error("Booking not found.", 404)

        # In production: verify Razorpay signature here
        # razorpay_signature = request.data.get("razorpay_signature")
        # key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
        # msg = f"{order_id}|{payment_id}"
        # expected = hmac.new(key_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        # if expected != razorpay_signature:
        #     return _error("Invalid payment signature.")

        if not mock_success:
            sr.payment_status = ServiceRequest.PaymentStatus.FAILED
            sr.save(update_fields=["payment_status", "updated_at"])
            return _error("Payment failed. Please try again.")

        # Mark booking confirmed + paid
        sr.status         = ServiceRequest.Status.CONFIRMED
        sr.payment_status = ServiceRequest.PaymentStatus.PAID
        sr.transaction_id = payment_id or f"TXN_{uuid.uuid4().hex[:12].upper()}"
        sr.payment_gateway = "mock"
        sr.invoice_id     = f"INV-{sr.request_id.replace('SR-', '')}-{uuid.uuid4().hex[:6].upper()}"
        sr.save(update_fields=["status", "payment_status", "transaction_id", "payment_gateway", "invoice_id", "updated_at"])

        return _success(
            data={
                "request_id":  sr.request_id,
                "booking_status": sr.status,
                "payment_status": sr.payment_status,
                "transaction_id": sr.transaction_id,
                "invoice_id":    sr.invoice_id,
            },
            message="Payment confirmed! Your booking is now active.",
        )


# ─── Employee: On The Way ─────────────────────────────────────────────────────

class EmployeeJobOnTheWayView(APIView):
    """PATCH /api/employee/jobs/<id>/on-the-way/"""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        from django.db import transaction
        from .state_machine import apply_transition
        try:
            job = EmployeeJob.objects.select_related("service_request").get(
                pk=pk, employee__user=request.user
            )
        except EmployeeJob.DoesNotExist:
            return _error("Job not found.", 404)

        if job.status != EmployeeJob.Status.ACCEPTED:
            return _error("Job must be in Accepted state to mark On The Way.")

        with transaction.atomic():
            apply_transition(job.service_request, ServiceRequest.Status.ON_THE_WAY)
            job.service_request.save(update_fields=["status", "updated_at"])
            job.status = EmployeeJob.Status.ON_THE_WAY
            job.save(update_fields=["status"])

        return _success(message="Status updated: On The Way.")


# ─── Employee: COD Cash Collection ───────────────────────────────────────────

class EmployeeCashCollectView(APIView):
    """
    PATCH /api/employee/jobs/<id>/collect-cash/
    Employee confirms COD cash was collected.
    Updates: payment_status = collected → paid, payment_collected_by, payment_collected_at, invoice_id
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        from django.db import transaction
        from employees.models import Employee

        try:
            job = EmployeeJob.objects.select_related("service_request", "employee").get(
                pk=pk, employee__user=request.user
            )
        except EmployeeJob.DoesNotExist:
            return _error("Job not found.", 404)

        sr = job.service_request

        if sr.payment_method != ServiceRequest.PaymentMethod.COD:
            return _error("Cash collection is only allowed for Cash on Service bookings.")

        if sr.payment_status == ServiceRequest.PaymentStatus.PAID:
            return _error("Cash has already been collected for this booking.")

        if job.status != EmployeeJob.Status.COMPLETED:
            return _error("Job must be completed before collecting cash.")

        with transaction.atomic():
            now = timezone.now()
            sr.payment_status        = ServiceRequest.PaymentStatus.PAID
            sr.payment_collected_by  = job.employee
            sr.payment_collected_at  = now
            if not sr.invoice_id:
                sr.invoice_id = f"INV-{sr.request_id.replace('SR-', '')}-{uuid.uuid4().hex[:6].upper()}"
            sr.save(update_fields=[
                "payment_status", "payment_collected_by", "payment_collected_at",
                "invoice_id", "updated_at"
            ])

        return _success(
            data={
                "request_id":    sr.request_id,
                "payment_status": sr.payment_status,
                "invoice_id":    sr.invoice_id,
                "collected_at":  now.isoformat(),
            },
            message="Cash collection confirmed. Payment marked as Paid.",
        )


# ─── Admin: Override Payment Status ──────────────────────────────────────────

class AdminPaymentUpdateView(APIView):
    """
    PATCH /api/admin/service-requests/<id>/payment/
    Admin manually overrides payment status (e.g. confirm COD collected).
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        from accounts.permissions import IsAdminRole
        if not hasattr(request.user, 'role') or request.user.role not in ('admin', 'manager', 'superadmin'):
            return _error("Admin access required.", 403)

        try:
            sr = ServiceRequest.objects.get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Booking not found.", 404)

        new_payment_status = request.data.get("payment_status")
        valid = [c[0] for c in ServiceRequest.PaymentStatus.choices]
        if new_payment_status not in valid:
            return _error(f"Invalid payment_status. Valid: {valid}")

        sr.payment_status = new_payment_status
        if new_payment_status == ServiceRequest.PaymentStatus.PAID and not sr.invoice_id:
            sr.invoice_id = f"INV-{sr.request_id.replace('SR-', '')}-{uuid.uuid4().hex[:6].upper()}"
        sr.save(update_fields=["payment_status", "invoice_id", "updated_at"])

        return _success(
            data=ServiceRequestDetailSerializer(sr, context={"request": request}).data,
            message=f"Payment status updated to {sr.payment_status}.",
        )


# ─── Invoice Generation ───────────────────────────────────────────────────────

class InvoiceDownloadView(APIView):
    """
    GET /api/booking/<id>/invoice/
    Generate and return a PDF invoice for a completed + paid booking.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        try:
            sr = ServiceRequest.objects.get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return _error("Booking not found.", 404)

        # Only generate invoice for paid bookings
        if sr.payment_status not in (ServiceRequest.PaymentStatus.PAID, ServiceRequest.PaymentStatus.COLLECTED):
            return _error("Invoice is only available after payment is confirmed.")

        try:
            pdf_bytes = self._generate_invoice_pdf(sr)
            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="Invoice-{sr.invoice_id or sr.request_id}.pdf"'
            return response
        except Exception as e:
            logger.error(f"Invoice generation failed: {e}")
            return _error("Failed to generate invoice. Please try again.")

    def _generate_invoice_pdf(self, sr):
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.colors import HexColor, black, white
        from reportlab.lib.units import mm
        from io import BytesIO

        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        W, H = A4

        # ── Header ──
        c.setFillColor(HexColor("#7C3AED"))
        c.rect(0, H - 80, W, 80, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(30, H - 45, "CalTrack Services")
        c.setFont("Helvetica", 11)
        c.drawString(30, H - 62, "Professional Home & Field Services")
        c.setFont("Helvetica-Bold", 14)
        c.drawRightString(W - 30, H - 45, "INVOICE")
        c.setFont("Helvetica", 10)
        c.drawRightString(W - 30, H - 62, f"#{sr.invoice_id or sr.request_id}")

        # ── Invoice Meta ──
        y = H - 110
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(30, y, "Booking Reference:")
        c.setFont("Helvetica", 10)
        c.drawString(180, y, sr.request_id)

        y -= 18
        c.setFont("Helvetica-Bold", 10)
        c.drawString(30, y, "Date:")
        c.setFont("Helvetica", 10)
        c.drawString(180, y, sr.created_at.strftime("%d %B %Y") if sr.created_at else "-")

        if sr.payment_collected_at:
            y -= 18
            c.setFont("Helvetica-Bold", 10)
            c.drawString(30, y, "Payment Date:")
            c.setFont("Helvetica", 10)
            c.drawString(180, y, sr.payment_collected_at.strftime("%d %B %Y %H:%M"))

        if sr.transaction_id:
            y -= 18
            c.setFont("Helvetica-Bold", 10)
            c.drawString(30, y, "Transaction ID:")
            c.setFont("Helvetica", 10)
            c.drawString(180, y, sr.transaction_id)

        # ── Customer Info ──
        y -= 30
        c.setFillColor(HexColor("#F8FAFC"))
        c.rect(25, y - 10, W - 50, 70, fill=1, stroke=0)
        c.setFillColor(HexColor("#7C3AED"))
        c.setFont("Helvetica-Bold", 10)
        c.drawString(35, y + 48, "BILLED TO")
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(35, y + 30, sr.customer_name)
        c.setFont("Helvetica", 10)
        c.drawString(35, y + 14, sr.phone)
        if sr.email:
            c.drawString(35, y - 2, sr.email)
        c.setFont("Helvetica", 9)
        addr = sr.address[:80] + "..." if len(sr.address) > 80 else sr.address
        c.drawString(35, y - 18, addr)

        # ── Service Table ──
        y -= 50
        c.setFillColor(HexColor("#7C3AED"))
        c.rect(25, y, W - 50, 24, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(35, y + 7, "Service")
        c.drawString(320, y + 7, "Qty")
        c.drawString(370, y + 7, "Rate")
        c.drawRightString(W - 35, y + 7, "Amount")

        y -= 5
        c.setFillColor(black)
        cart = sr.cart_data or []
        if isinstance(cart, str):
            import json
            try:
                cart = json.loads(cart)
            except Exception:
                cart = []

        if cart:
            for i, item in enumerate(cart):
                y -= 22
                bg = HexColor("#F8FAFC") if i % 2 == 0 else white
                c.setFillColor(bg)
                c.rect(25, y - 4, W - 50, 22, fill=1, stroke=0)
                c.setFillColor(black)
                c.setFont("Helvetica", 10)
                name = str(item.get("name", "Service"))[:40]
                c.drawString(35, y + 4, name)
                qty = item.get("quantity", 1)
                c.drawString(320, y + 4, str(qty))
                price = float(item.get("price", 0))
                c.drawString(370, y + 4, f"\u20b9{price:,.0f}")
                c.drawRightString(W - 35, y + 4, f"\u20b9{price * qty:,.0f}")
        else:
            y -= 22
            c.setFont("Helvetica", 10)
            c.drawString(35, y + 4, sr.issue_title)
            c.drawString(320, y + 4, "1")
            c.drawString(370, y + 4, f"\u20b9{float(sr.total_amount):,.0f}")
            c.drawRightString(W - 35, y + 4, f"\u20b9{float(sr.total_amount):,.0f}")

        # ── Totals ──
        y -= 35
        c.setStrokeColor(HexColor("#E2E8F0"))
        c.line(25, y + 20, W - 25, y + 20)
        c.setFont("Helvetica", 10)
        c.drawString(320, y + 4, "Subtotal:")
        c.drawRightString(W - 35, y + 4, f"\u20b9{float(sr.total_amount):,.0f}")
        y -= 18
        c.drawString(320, y + 4, "Platform Fee:")
        c.setFillColor(HexColor("#059669"))
        c.drawRightString(W - 35, y + 4, "FREE")
        c.setFillColor(black)
        y -= 18
        c.drawString(320, y + 4, "Travel Charges:")
        c.setFillColor(HexColor("#059669"))
        c.drawRightString(W - 35, y + 4, "FREE")

        y -= 28
        c.setFillColor(HexColor("#7C3AED"))
        c.rect(310, y - 6, W - 310 - 25, 28, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(320, y + 6, "TOTAL PAID:")
        c.drawRightString(W - 35, y + 6, f"\u20b9{float(sr.total_amount):,.2f}")

        # ── Payment Method Badge ──
        y -= 45
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(30, y, f"Payment Method: {sr.get_payment_method_display()}")
        c.setFont("Helvetica", 10)
        c.drawString(30, y - 16, f"Payment Status: {sr.get_payment_status_display()}")
        if sr.preferred_date:
            c.drawString(30, y - 32, f"Service Date: {sr.preferred_date.strftime('%d %B %Y')}")

        # ── Footer ──
        c.setFillColor(HexColor("#F1F5F9"))
        c.rect(0, 0, W, 45, fill=1, stroke=0)
        c.setFillColor(HexColor("#64748B"))
        c.setFont("Helvetica", 8)
        c.drawCentredString(W / 2, 28, "Thank you for choosing CalTrack Services!")
        c.drawCentredString(W / 2, 14, "For support: support@caltrack.in | This is a computer-generated invoice.")

        c.save()
        buffer.seek(0)
        return buffer.read()
