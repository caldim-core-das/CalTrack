"""
service_requests/tests/test_phase5_rescheduling.py

Phase 5 Exit Condition & Rescheduling Escalation Tests:
1. 1st Parts Delay -> Updates preferred_date, sets customer_notified_at
2. 2nd Parts Delay -> Blocks silent auto-reschedule, freezes preferred_date, sets support_callback_created = True
3. Reschedule Audit Trail -> Logs old_date, new_date, delay_count, reason, and changed_by
4. Customer Objection / Contact Support -> Customer requests Support callback, not forced to accept silently
5. Original Work Completed Distinction -> Primary job COMPLETED while extension is delayed -> original work logged done
6. Commercial Approval Preserved -> Customer accepted amount preserved across rescheduling
7. Customer-Confirmed Reschedule -> Customer confirms proposed date -> customer_confirmed_at timestamp set
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob, WorkExtension, JobReschedule
from service_requests.services.decision_service import record_customer_decision

User = get_user_model()


from django_tenants.test.cases import TenantTestCase


class Phase5ReschedulingTests(TenantTestCase):
    @classmethod
    def get_test_schema_name(cls):
        return "test_phase5"
    def setUp(self):
        super().setUp()
        self.company = self.tenant
        self.user_admin = User.objects.create_user(username="admin_p5", password="password123", role="admin")
        self.user_tech = User.objects.create_user(username="tech_p5", password="password123", role="employee")
        self.employee_tech = Employee.objects.create(user=self.user_tech, company=self.company, employee_id="EMP-P5-01")

        self.initial_date = timezone.now().date()
        self.service_request = ServiceRequest.objects.create(
            company=self.company,
            customer_name="Phase 5 Customer",
            phone="9222333444",
            service_category="hvac",
            issue_title="Compressor Replacement Delayed",
            address="500 Delay Drive",
            preferred_date=self.initial_date,
            status=ServiceRequest.Status.IN_PROGRESS,
        )

        self.job = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_tech,
            assigned_by=self.user_admin,
            is_primary=True,
            status=EmployeeJob.Status.AWAITING_PARTS,
        )

    def test_01_first_delay_reschedule(self):
        """Phase 5: 1st parts delay -> Updates preferred_date & sets customer_notified_at."""
        new_date = self.initial_date + timezone.timedelta(days=3)

        self.client.force_login(self.user_tech)
        response = self.client.post(
            f"/api/employee/jobs/{self.job.id}/reschedule/",
            data={
                "new_date": str(new_date),
                "reason": JobReschedule.Reason.PARTS_UNAVAILABLE,
                "notes": "Compressor part backordered 3 days",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.service_request.refresh_from_db()
        self.assertEqual(self.service_request.preferred_date, new_date)

        reschedules = JobReschedule.objects.filter(job=self.job)
        self.assertEqual(reschedules.count(), 1)
        res = reschedules.first()
        self.assertEqual(res.delay_count, 1)
        self.assertFalse(res.support_callback_created)
        self.assertIsNotNone(res.customer_notified_at)

    def test_02_second_delay_escalated_to_support(self):
        """Phase 5: 2nd parts delay -> Blocks silent date change, creates Support callback ticket."""
        date1 = self.initial_date + timezone.timedelta(days=3)
        date2 = self.initial_date + timezone.timedelta(days=7)

        self.client.force_login(self.user_tech)

        # 1st delay
        self.client.post(
            f"/api/employee/jobs/{self.job.id}/reschedule/",
            data={"new_date": str(date1), "reason": JobReschedule.Reason.PARTS_UNAVAILABLE, "notes": "1st delay"},
            content_type="application/json",
        )

        self.service_request.refresh_from_db()
        self.assertEqual(self.service_request.preferred_date, date1)

        # 2nd delay -> ESCALATION
        response = self.client.post(
            f"/api/employee/jobs/{self.job.id}/reschedule/",
            data={"new_date": str(date2), "reason": JobReschedule.Reason.PARTS_UNAVAILABLE, "notes": "2nd delay supplier shortage"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.service_request.refresh_from_db()
        # Date remains frozen at date1 (silent auto-reschedule blocked!)
        self.assertEqual(self.service_request.preferred_date, date1)

        reschedules = JobReschedule.objects.filter(job=self.job).order_by("created_at")
        self.assertEqual(reschedules.count(), 2)

        res2 = reschedules.last()
        self.assertEqual(res2.delay_count, 2)
        self.assertTrue(res2.support_callback_created)
        self.assertIn("[ESCALATED TO SUPPORT CALLBACK]", res2.notes)

    def test_03_reschedule_audit_trail(self):
        """Phase 5: Reschedule history preserves full audit log."""
        date1 = self.initial_date + timezone.timedelta(days=2)

        self.client.force_login(self.user_tech)
        self.client.post(
            f"/api/employee/jobs/{self.job.id}/reschedule/",
            data={"new_date": str(date1), "reason": JobReschedule.Reason.SPECIALIST_UNAVAILABLE, "notes": "Specialist occupied"},
            content_type="application/json",
        )

        res = JobReschedule.objects.get(job=self.job)
        self.assertEqual(res.old_date, self.initial_date)
        self.assertEqual(res.new_date, date1)
        self.assertEqual(res.reason, JobReschedule.Reason.SPECIALIST_UNAVAILABLE)
        self.assertEqual(res.changed_by, self.user_tech)

    def test_04_customer_objection_contact_support(self):
        """Test 4: Customer selects Contact Support on reschedule -> Support callback created."""
        reschedule = JobReschedule.objects.create(
            job=self.job,
            old_date=self.initial_date,
            new_date=self.initial_date + timezone.timedelta(days=4),
            reason=JobReschedule.Reason.PARTS_UNAVAILABLE,
            notes="1st delay proposed",
        )

        response = self.client.post(
            f"/api/customer/reschedule/{reschedule.id}/contact-support/",
            data={"notes": "Proposed date conflict with work travel"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        reschedule.refresh_from_db()
        self.assertTrue(reschedule.support_callback_created)
        self.assertIn("[CUSTOMER REQUESTED SUPPORT CALLBACK]", reschedule.notes)

    def test_05_original_work_already_completed_distinction(self):
        """Test 5: Primary Job 1 is COMPLETED, additional work is waiting for part -> Original work logged done."""
        # Mark primary Job 1 complete
        self.job.status = EmployeeJob.Status.COMPLETED
        self.job.save()

        # Job 2 is created for additional work, awaiting parts
        job2 = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_tech,
            assigned_by=self.user_admin,
            is_primary=False,
            status=EmployeeJob.Status.AWAITING_PARTS,
        )

        reschedule = JobReschedule.objects.create(
            job=job2,
            old_date=self.initial_date,
            new_date=self.initial_date + timezone.timedelta(days=5),
            reason=JobReschedule.Reason.PARTS_UNAVAILABLE,
        )

        primary_job = self.service_request.get_primary_job()
        self.assertEqual(primary_job.status, EmployeeJob.Status.COMPLETED)
        self.assertEqual(job2.status, EmployeeJob.Status.AWAITING_PARTS)

    def test_06_commercial_approval_preserved_across_rescheduling(self):
        """Test 6: Customer accepted ₹2,700 -> Parts delayed -> Status remains CUSTOMER_ACCEPTED & amount ₹2,700."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("3000.00"),
            admin_approved_amount=Decimal("2700.00"),
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

        record_customer_decision(extension=ext, decision="ACCEPT", channel="portal")
        self.assertEqual(ext.status, WorkExtension.Status.CUSTOMER_ACCEPTED)
        self.assertEqual(ext.final_customer_amount, Decimal("2700.00"))

        # Parts delay occurs -> Reschedule
        reschedule = JobReschedule.objects.create(
            job=self.job,
            old_date=self.initial_date,
            new_date=self.initial_date + timezone.timedelta(days=3),
            reason=JobReschedule.Reason.PARTS_UNAVAILABLE,
        )

        ext.refresh_from_db()
        # Commercial acceptance and approved price remain strictly untouched
        self.assertEqual(ext.status, WorkExtension.Status.CUSTOMER_ACCEPTED)
        self.assertEqual(ext.final_customer_amount, Decimal("2700.00"))

    def test_07_customer_confirmed_reschedule(self):
        """Test 7: Customer confirms proposed reschedule date -> customer_confirmed_at timestamp is set."""
        reschedule = JobReschedule.objects.create(
            job=self.job,
            old_date=self.initial_date,
            new_date=self.initial_date + timezone.timedelta(days=3),
            reason=JobReschedule.Reason.PARTS_UNAVAILABLE,
        )

        response = self.client.post(
            f"/api/customer/reschedule/{reschedule.id}/confirm/",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        reschedule.refresh_from_db()
        self.service_request.refresh_from_db()
        self.assertIsNotNone(reschedule.customer_confirmed_at)
        self.assertEqual(self.service_request.preferred_date, reschedule.new_date)
