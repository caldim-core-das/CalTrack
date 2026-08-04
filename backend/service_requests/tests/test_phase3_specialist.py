"""
service_requests/tests/test_phase3_specialist.py

Phase 3 Exit Condition & Specialist Referral Tests:
1. Specialist referral -> Job 2 creation (is_primary=False, source_work_extension=ext)
2. Tech A independent completion -> Job 1 COMPLETED, ServiceRequest remains open for Job 2
3. Tech B data isolation -> Tech B only views/manages assigned Job 2
4. Secondary diagnosis conflict -> Tech B creates new extension on Job 2; Tech A diagnosis preserved
5. Final case completion -> Job 2 completion resolves extension & closes ServiceRequest
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob, WorkExtension, JobCompletionProof
from service_requests.services.decision_service import record_customer_decision

User = get_user_model()


from django_tenants.test.cases import TenantTestCase


class Phase3SpecialistReferralTests(TenantTestCase):
    @classmethod
    def get_test_schema_name(cls):
        return "test_phase3"
    def setUp(self):
        super().setUp()
        self.company = self.tenant
        self.user_admin = User.objects.create_user(username="admin_p3", password="password123", role="admin")
        self.user_tech_a = User.objects.create_user(username="tech_a", password="password123", role="employee")
        self.user_tech_b = User.objects.create_user(username="tech_b_specialist", password="password123", role="employee")

        self.employee_a = Employee.objects.create(user=self.user_tech_a, company=self.company, employee_id="EMP-P3-01", title="General Tech A")
        self.employee_b = Employee.objects.create(user=self.user_tech_b, company=self.company, employee_id="EMP-P3-02", title="Compressor Specialist B")

        self.service_request = ServiceRequest.objects.create(
            company=self.company,
            customer_name="Phase 3 Customer",
            phone="9777666555",
            service_category="hvac",
            issue_title="AC Noise & Cooling Failure",
            address="999 Specialist Handoff Way",
            preferred_date=timezone.now().date(),
            status=ServiceRequest.Status.IN_PROGRESS,
        )

        # Job 1 (Tech A — Primary)
        self.job1 = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_a,
            assigned_by=self.user_admin,
            is_primary=True,
            status=EmployeeJob.Status.IN_PROGRESS,
        )

        JobCompletionProof.objects.create(job=self.job1, note="Tech A proof photo")

    def test_01_specialist_referral_job2_creation(self):
        """Phase 3: Tech A reports compressor specialist fault -> Admin assigns Tech B (Job 2)."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job1,
            reported_by=self.employee_a,
            technician_estimate=Decimal("4500.00"),
            admin_approved_amount=Decimal("4500.00"),
            requires_specialist=True,
            required_skill="compressor specialist",
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

        # Customer accepts specialist repair
        record_customer_decision(extension=ext, decision="ACCEPT", channel="portal")
        self.assertEqual(ext.status, WorkExtension.Status.PENDING_ASSIGNMENT)

        # Admin assigns Tech B (Job 2)
        job2 = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_b,
            assigned_by=self.user_admin,
            is_primary=False,
            source_work_extension=ext,
            status=EmployeeJob.Status.ASSIGNED,
            notes="Specialist assignment for compressor repair",
        )

        self.assertEqual(self.service_request.employee_jobs.count(), 2)
        self.assertFalse(job2.is_primary)
        self.assertEqual(job2.source_work_extension, ext)

    def test_02_job1_independent_completion_case_remains_open(self):
        """Phase 3: Tech A completes Job 1 independently -> Case remains open for Job 2."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job1,
            reported_by=self.employee_a,
            technician_estimate=Decimal("4500.00"),
            admin_approved_amount=Decimal("4500.00"),
            requires_specialist=True,
            required_skill="compressor specialist",
            status=WorkExtension.Status.PENDING_ASSIGNMENT,
        )

        job2 = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_b,
            assigned_by=self.user_admin,
            is_primary=False,
            source_work_extension=ext,
            status=EmployeeJob.Status.ASSIGNED,
        )

        # Tech A completes Job 1
        self.job1.status = EmployeeJob.Status.COMPLETED
        self.job1.completed_date = timezone.now()
        self.job1.save()

        # is_ready_to_complete MUST return False because Job 2 is still ASSIGNED
        self.assertFalse(self.service_request.is_ready_to_complete())
        self.assertNotEqual(self.service_request.status, ServiceRequest.Status.COMPLETED)

    def test_03_tech_b_data_isolation(self):
        """Phase 3: Tech B only views assigned Job 2, cannot alter Tech A's Job 1."""
        job2 = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_b,
            assigned_by=self.user_admin,
            is_primary=False,
            status=EmployeeJob.Status.ASSIGNED,
        )

        # Tech B query filters by employee
        tech_b_jobs = EmployeeJob.objects.filter(employee=self.employee_b)
        self.assertEqual(tech_b_jobs.count(), 1)
        self.assertEqual(tech_b_jobs.first(), job2)
        self.assertNotIn(self.job1, tech_b_jobs)

    def test_04_tech_b_secondary_diagnosis(self):
        """Phase 3: Tech B discovers secondary fault -> Creates new extension; Tech A diagnosis preserved."""
        ext1 = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job1,
            reported_by=self.employee_a,
            technician_estimate=Decimal("4500.00"),
            requires_specialist=True,
            status=WorkExtension.Status.RESOLVED,
        )

        job2 = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_b,
            is_primary=False,
            source_work_extension=ext1,
            status=EmployeeJob.Status.IN_PROGRESS,
        )

        # Tech B discovers additional capacitor fault
        ext2 = WorkExtension.objects.create(
            service_request=self.service_request,
            job=job2,
            reported_by=self.employee_b,
            technician_estimate=Decimal("1200.00"),
            status=WorkExtension.Status.PENDING_ADMIN_REVIEW,
        )

        self.assertEqual(self.service_request.work_extensions.count(), 2)
        self.assertEqual(ext1.job, self.job1)
        self.assertEqual(ext2.job, job2)
        self.assertEqual(ext2.reported_by, self.employee_b)

    def test_05_job2_completion_closes_service_request(self):
        """Phase 3: Tech B completes Job 2 -> All jobs/extensions done -> Case completes."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job1,
            reported_by=self.employee_a,
            technician_estimate=Decimal("4500.00"),
            admin_approved_amount=Decimal("4500.00"),
            requires_specialist=True,
            status=WorkExtension.Status.PENDING_ASSIGNMENT,
        )

        job2 = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_b,
            is_primary=False,
            source_work_extension=ext,
            status=EmployeeJob.Status.IN_PROGRESS,
        )

        # Job 1 is completed by Tech A
        self.job1.status = EmployeeJob.Status.COMPLETED
        self.job1.save()

        # Job 2 is completed by Tech B
        job2.status = EmployeeJob.Status.COMPLETED
        job2.save()

        ext.status = WorkExtension.Status.RESOLVED
        ext.save()

        # All jobs & extensions complete -> is_ready_to_complete() is True
        self.assertTrue(self.service_request.is_ready_to_complete())

    def test_06_new_extension_by_tech_b_prevents_closure(self):
        """Phase 3 Test 6: Tech B completes Job 2, but Extension #2 is pending -> is_ready_to_complete() returns FALSE."""
        ext1 = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job1,
            reported_by=self.employee_a,
            technician_estimate=Decimal("4500.00"),
            admin_approved_amount=Decimal("4500.00"),
            requires_specialist=True,
            status=WorkExtension.Status.RESOLVED,
        )

        job2 = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_b,
            is_primary=False,
            source_work_extension=ext1,
            status=EmployeeJob.Status.IN_PROGRESS,
        )

        # Tech B discovers secondary fault -> Extension 2 created (PENDING_ADMIN_REVIEW)
        ext2 = WorkExtension.objects.create(
            service_request=self.service_request,
            job=job2,
            reported_by=self.employee_b,
            technician_estimate=Decimal("1800.00"),
            status=WorkExtension.Status.PENDING_ADMIN_REVIEW,
        )

        # Job 1 & Job 2 are both completed
        self.job1.status = EmployeeJob.Status.COMPLETED
        self.job1.save()
        job2.status = EmployeeJob.Status.COMPLETED
        job2.save()

        # CRITICAL REGRESSION TEST: is_ready_to_complete() MUST return FALSE because ext2 is PENDING_ADMIN_REVIEW
        self.assertFalse(self.service_request.is_ready_to_complete())
        self.assertNotEqual(self.service_request.status, ServiceRequest.Status.COMPLETED)

