import datetime
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError

from companies.models import Company
from employees.models import Employee
from service_requests.models import (
    ServiceRequest, RescheduleRequest, RescheduleStatus, RescheduleReason, TimeSlotChoices
)
from service_requests import services as sr_services

User = get_user_model()


class RescheduleWorkflowTestCase(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            company_name="Test CalTrack Corp",
            reschedule_rejection_strategy="auto_reassign"
        )

        self.customer_user = User.objects.create_user(
            username="customer_user",
            email="customer@example.com",
            password="Password123!",
            role="customer"
        )

        self.admin_user = User.objects.create_user(
            username="admin_user",
            email="admin@example.com",
            password="Password123!",
            role="admin",
            is_staff=True
        )

        self.tech_user = User.objects.create_user(
            username="tech_user",
            email="tech@example.com",
            password="Password123!",
            role="employee"
        )
        self.tech_employee = Employee.objects.create(
            user=self.tech_user,
            employee_id="EMP-001",
            company=self.company
        )

        self.booking = ServiceRequest.objects.create(
            company=self.company,
            customer=self.customer_user,
            customer_name="Test Customer",
            phone="1234567890",
            email="customer@example.com",
            service_category="plumbing",
            issue_title="Leaking Pipe",
            address="123 Main St",
            preferred_date=datetime.date(2026, 8, 1),
            preferred_time="09-10",
            status="confirmed",
            assigned_employee=self.tech_employee
        )

        self.client = APIClient()

    def test_create_reschedule_request_success(self):
        rr = sr_services.create_reschedule_request(
            booking=self.booking,
            requested_by=self.customer_user,
            new_date=datetime.date(2026, 8, 5),
            new_time_slot="10-11",
            reason=RescheduleReason.SCHEDULE_CONFLICT,
            persona="CUSTOMER",
            additional_notes="Prefer morning slot"
        )
        self.assertEqual(rr.status, RescheduleStatus.PENDING)
        self.assertEqual(rr.current_date, datetime.date(2026, 8, 1))
        self.assertEqual(rr.new_date, datetime.date(2026, 8, 5))
        self.assertEqual(rr.new_time_slot, "10-11")

    def test_invalid_state_transition_fails(self):
        rr = sr_services.create_reschedule_request(
            booking=self.booking,
            requested_by=self.customer_user,
            new_date=datetime.date(2026, 8, 5),
            new_time_slot="10-11",
            reason=RescheduleReason.EMERGENCY
        )
        # Attempt direct jump from PENDING to APPROVED (not allowed)
        with self.assertRaises(ValidationError):
            sr_services.apply_transition(rr, RescheduleStatus.APPROVED, actor=self.admin_user)

    def test_full_successful_transition_pipeline(self):
        rr = sr_services.create_reschedule_request(
            booking=self.booking,
            requested_by=self.customer_user,
            new_date=datetime.date(2026, 8, 5),
            new_time_slot="10-11",
            reason=RescheduleReason.SCHEDULE_CONFLICT
        )

        # 1. PENDING -> ADMIN_REVIEW
        rr = sr_services.apply_transition(rr, RescheduleStatus.ADMIN_REVIEW, actor=self.admin_user)
        self.assertEqual(rr.status, RescheduleStatus.ADMIN_REVIEW)

        # 2. ADMIN_REVIEW -> TECHNICIAN_CONFIRMATION
        rr = sr_services.apply_transition(
            rr,
            RescheduleStatus.TECHNICIAN_CONFIRMATION,
            actor=self.admin_user,
            proposed_technician=self.tech_employee
        )
        self.assertEqual(rr.status, RescheduleStatus.TECHNICIAN_CONFIRMATION)

        # 3. TECHNICIAN_CONFIRMATION -> APPROVED (auto moves to CUSTOMER_NOTIFIED)
        rr = sr_services.apply_transition(
            rr,
            RescheduleStatus.APPROVED,
            actor=self.tech_user,
            note="Confirmed available"
        )
        self.assertEqual(rr.status, RescheduleStatus.CUSTOMER_NOTIFIED)

        # Verify booking updated date/time
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.preferred_date, datetime.date(2026, 8, 5))
        self.assertEqual(self.booking.preferred_time, "10-11")

    def test_customer_create_view_api(self):
        self.client.force_authenticate(user=self.customer_user)
        res = self.client.post("/api/service-requests/customer/reschedules/create/", {
            "booking_id": self.booking.id,
            "new_date": "2026-08-10",
            "new_time_slot": "14-15",
            "reason": "emergency"
        }, format="json")

        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["data"]["status"], RescheduleStatus.PENDING)
        self.assertIn("available_slots", res.data["meta"])

    def test_cancel_reschedule_request(self):
        rr = sr_services.create_reschedule_request(
            booking=self.booking,
            requested_by=self.customer_user,
            new_date=datetime.date(2026, 8, 5),
            new_time_slot="10-11",
            reason=RescheduleReason.SCHEDULE_CONFLICT
        )
        cancelled = sr_services.cancel_reschedule_request(self.customer_user, rr.id)
        self.assertEqual(cancelled.status, RescheduleStatus.CANCELLED)

    def test_12_hour_policy_violation(self):
        soon_booking = ServiceRequest.objects.create(
            company=self.company,
            customer=self.customer_user,
            customer_name="Test Customer",
            phone="1234567890",
            email="customer@example.com",
            service_category="plumbing",
            issue_title="Leaking Pipe",
            address="123 Main St",
            preferred_date=datetime.date.today(),
            preferred_time="09-10",
            status="confirmed",
        )
        with self.assertRaises(ValidationError):
            sr_services.create_reschedule_request(
                booking=soon_booking,
                requested_by=self.customer_user,
                new_date=datetime.date(2026, 8, 5),
                new_time_slot="10-11",
                reason=RescheduleReason.SCHEDULE_CONFLICT
            )
