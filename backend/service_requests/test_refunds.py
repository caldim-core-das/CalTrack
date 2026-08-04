import decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError

from companies.models import Company
from employees.models import Employee
from service_requests.models import (
    ServiceRequest, RefundRequest, RefundStatus, RefundType, RefundReason, RefundInfoTarget, RefundEvidence, RefundInvestigationNote
)
from service_requests import services as sr_services

User = get_user_model()


class RefundWorkflowTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(company_name="Test Service Co", schema_name="testco")
        self.customer_user = User.objects.create_user(
            username="refund_customer",
            email="refcustomer@example.com",
            password="Password123!",
            role="customer",
            first_name="Jane",
            last_name="Doe"
        )
        self.admin_user = User.objects.create_user(
            username="refund_admin",
            email="refadmin@example.com",
            password="Password123!",
            role="admin",
            first_name="Admin",
            last_name="User"
        )
        self.emp_user = User.objects.create_user(
            username="refund_tech",
            email="reftech@example.com",
            password="Password123!",
            role="employee",
            first_name="Tech",
            last_name="One"
        )
        self.employee = Employee.objects.create(
            user=self.emp_user,
            company=self.company,
            employee_id="EMP-101"
        )

        import datetime
        self.booking = ServiceRequest.objects.create(
            request_id="SR-2026-999",
            customer=self.customer_user,
            company=self.company,
            issue_title="AC Repair",
            service_category="HVAC",
            preferred_date=datetime.date.today(),
            status="completed",
            payment_status="paid",
            total_amount=decimal.Decimal("500.00"),
            assigned_employee=self.employee
        )

        self.client = APIClient()

    def test_eligibility_and_summary(self):
        bookings = sr_services.get_eligible_bookings(self.customer_user)
        self.assertEqual(len(bookings), 1)
        self.assertEqual(bookings[0].id, self.booking.id)

        summary = sr_services.get_booking_refund_summary(self.customer_user, self.booking.id)
        self.assertTrue(summary["eligible"])
        self.assertEqual(summary["paid_amount"], decimal.Decimal("500.00"))
        self.assertEqual(summary["max_refundable_amount"], decimal.Decimal("500.00"))

    def test_customer_refund_creation(self):
        rr = sr_services.create_refund_request(
            customer=self.customer_user,
            booking_id=self.booking.id,
            refund_type=RefundType.FULL,
            requested_amount=500.00,
            reason=RefundReason.POOR_QUALITY,
            additional_notes="AC stopped working after 2 hours."
        )
        self.assertEqual(rr.status, RefundStatus.PENDING)
        self.assertEqual(rr.requested_amount, decimal.Decimal("500.00"))

        # Check that customer cannot create a duplicate request while pending
        with self.assertRaises(ValidationError):
            sr_services.create_refund_request(
                customer=self.customer_user,
                booking_id=self.booking.id,
                refund_type=RefundType.FULL,
                requested_amount=500.00,
                reason=RefundReason.POOR_QUALITY
            )

    def test_admin_and_employee_workflow(self):
        rr = sr_services.create_refund_request(
            customer=self.customer_user,
            booking_id=self.booking.id,
            refund_type=RefundType.PARTIAL,
            requested_amount=200.00,
            reason=RefundReason.SERVICE_NOT_COMPLETED
        )

        # Admin requests info from Employee
        rr_info = sr_services.admin_request_more_info(
            admin_user=self.admin_user,
            refund_id=rr.id,
            target=RefundInfoTarget.EMPLOYEE,
            note="Tech, please confirm if work was completed."
        )
        self.assertEqual(rr_info.status, RefundStatus.INFO_REQUESTED)
        self.assertEqual(rr_info.info_requested_from, RefundInfoTarget.EMPLOYEE)
        self.assertEqual(rr_info.assigned_employee, self.employee)

        # Employee submits investigation
        rr_resp = sr_services.employee_submit_investigation(
            employee_user=self.emp_user,
            refund_id=rr.id,
            explanation="I checked the AC, single valve was replaced.",
            work_completed_confirmed=True
        )
        self.assertEqual(rr_resp.status, RefundStatus.PENDING)

        # Admin approves partial refund
        rr_app = sr_services.admin_approve_refund(
            admin_user=self.admin_user,
            refund_id=rr.id,
            is_full=False,
            approved_amount=200.00,
            internal_note="Partial refund approved post tech review."
        )
        self.assertEqual(rr_app.status, RefundStatus.APPROVED_PARTIAL)
        self.assertEqual(rr_app.approved_amount, decimal.Decimal("200.00"))

        # Admin sends to finance
        rr_fin = sr_services.admin_send_to_finance(self.admin_user, rr.id)
        self.assertEqual(rr_fin.status, RefundStatus.SENT_TO_FINANCE)

        # Admin completes refund
        rr_done = sr_services.admin_complete_refund(self.admin_user, rr.id)
        self.assertEqual(rr_done.status, RefundStatus.COMPLETED)
