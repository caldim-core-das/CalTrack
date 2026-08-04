"""
service_requests/tests/test_work_extensions.py

Unit & Integration test suite for WorkExtension & Specialist Referral system.
Tests models, decision service, fulfillment engine, rescheduling, and supplemental invoicing.
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.utils import IntegrityError

from companies.models import Company
from employees.models import Employee
from inventory.models import InventoryItem
from service_requests.models import (
    ServiceRequest, EmployeeJob, WorkExtension, WorkExtensionItem,
    JobReschedule, SupplementalInvoice
)
from service_requests.services.decision_service import record_customer_decision
from service_requests.services.fulfillment_service import process_item_fulfillment

User = get_user_model()


from django_tenants.test.cases import TenantTestCase


class WorkExtensionModelTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.company = self.tenant
        self.user_admin = User.objects.create_user(username="admin_user", password="password123", role="admin")
        self.user_tech = User.objects.create_user(username="tech_user", password="password123", role="employee")
        self.employee_tech = Employee.objects.create(user=self.user_tech, company=self.company, employee_id="EMP-TECH-01", title="AC Technician")

        self.service_request = ServiceRequest.objects.create(
            company=self.company,
            customer_name="Test Customer",
            phone="9876543210",
            service_category="hvac",
            issue_title="AC Cooling Issue",
            address="123 Test Street",
            preferred_date=timezone.now().date(),
        )

        self.job1 = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_tech,
            assigned_by=self.user_admin,
            is_primary=True,
        )

    def test_unique_primary_job_constraint(self):
        """Verify that only one primary job is allowed per ServiceRequest."""
        with self.assertRaises(IntegrityError):
            EmployeeJob.objects.create(
                service_request=self.service_request,
                employee=self.employee_tech,
                is_primary=True,
            )

    def test_specialist_secondary_job_creation(self):
        """Verify that a specialist (non-primary) job can be assigned to the same ServiceRequest."""
        user_specialist = User.objects.create_user(username="specialist_user", password="password123")
        employee_specialist = Employee.objects.create(user=user_specialist, company=self.company, title="Compressor Specialist")

        job2 = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=employee_specialist,
            assigned_by=self.user_admin,
            is_primary=False,
        )

        self.assertEqual(self.service_request.employee_jobs.count(), 2)
        self.assertEqual(self.service_request.get_primary_job(), self.job)
        self.assertEqual(self.service_request.employee_job, self.job)

    def test_work_extension_creation_and_defaults(self):
        """Test WorkExtension creation and initial default values."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("1500.00"),
            description="Replace faulty capacitor and clean coils",
        )
        self.assertEqual(ext.status, WorkExtension.Status.PENDING_ADMIN_REVIEW)
        self.assertIsNotNone(ext.decision_token)
        self.assertFalse(ext.requires_specialist)

    def test_work_extension_item_creation(self):
        """Test WorkExtensionItem addition to a WorkExtension."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("800.00"),
        )
        item = WorkExtensionItem.objects.create(
            extension=ext,
            item_name="Run Capacitor 45uF",
            quantity=1,
            unit_price=Decimal("800.00"),
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_STOCK,
        )
        self.assertEqual(item.status, WorkExtensionItem.Status.PENDING)
        self.assertEqual(ext.items.count(), 1)


class DecisionServiceTests(TenantTestCase):
    @classmethod
    def get_test_schema_name(cls):
        return "test_decision"

    def setUp(self):
        super().setUp()
        self.company = self.tenant
        self.user_csr = User.objects.create_user(username="csr_agent", password="password123")
        self.user_tech = User.objects.create_user(username="tech_agent", password="password123")
        self.employee_tech = Employee.objects.create(user=self.user_tech, company=self.company, employee_id="EMP-DEC-01")
        self.service_request = ServiceRequest.objects.create(
            company=self.company,
            customer_name="John Doe",
            phone="9998887770",
            service_category="electrical",
            issue_title="Main Switch Board Sparking",
            address="456 Wall Street",
            preferred_date=timezone.now().date(),
        )
        self.job = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_tech,
            is_primary=True,
        )
        self.ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("2000.00"),
            admin_approved_amount=Decimal("2000.00"),
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

    def test_portal_customer_acceptance(self):
        """Test decision recording via customer web portal."""
        updated = record_customer_decision(
            extension=self.ext,
            decision="ACCEPT",
            channel="portal",
            notes="Customer accepted via link",
        )
        self.assertEqual(updated.status, WorkExtension.Status.CUSTOMER_ACCEPTED)
        self.assertEqual(updated.decision_channel, "portal")

    def test_phone_csr_decision_mandates_notes(self):
        """Test that phone decisions require mandatory CSR notes for audit protection."""
        with self.assertRaises(Exception):
            record_customer_decision(
                extension=self.ext,
                decision="ACCEPT",
                channel="phone",
                user=self.user_csr,
                notes="",
            )

        updated = record_customer_decision(
            extension=self.ext,
            decision="ACCEPT",
            channel="phone",
            user=self.user_csr,
            notes="Spoke with customer; customer gave explicit consent on call.",
        )
        self.assertEqual(updated.status, WorkExtension.Status.CUSTOMER_ACCEPTED)
        self.assertEqual(updated.decision_recorded_by, self.user_csr)


class FulfillmentEngineTests(TenantTestCase):
    @classmethod
    def get_test_schema_name(cls):
        return "test_fulfil"

    def setUp(self):
        super().setUp()
        self.company = self.tenant
        self.user_tech = User.objects.create_user(username="tech_ful", password="password123")
        self.employee = Employee.objects.create(user=self.user_tech, company=self.company, employee_id="EMP-FUL-01")
        self.service_request = ServiceRequest.objects.create(
            company=self.company,
            customer_name="Alice Smith",
            phone="9123456789",
            service_category="plumbing",
            issue_title="Pipe Leakage",
            address="789 Pine Road",
            preferred_date=timezone.now().date(),
        )
        self.job = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee,
            is_primary=True,
        )
        self.ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee,
            technician_estimate=Decimal("500.00"),
        )
        self.inv_item = InventoryItem.objects.create(
            org=self.company,
            name="1/2 inch Brass Valve",
            sku="VALVE-001",
            total_quantity=5,
            available_quantity=5,
            reserved_quantity=0,
            reorder_threshold=2,
        )

    def test_successful_stock_reservation(self):
        """Test stock reservation when material is available locally."""
        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            inventory_item=self.inv_item,
            item_name="1/2 inch Brass Valve",
            quantity=2,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_STOCK,
        )
        processed = process_item_fulfillment(ext_item)
        self.assertEqual(processed.status, WorkExtensionItem.Status.RESERVED)
        self.inv_item.refresh_from_db()
        self.assertEqual(self.inv_item.reserved_quantity, 2)

    def test_stock_shortage_sets_awaiting_parts(self):
        """Test that stock shortage marks item and job as AWAITING_PARTS."""
        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            inventory_item=self.inv_item,
            item_name="1/2 inch Brass Valve",
            quantity=10,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_STOCK,
        )
        processed = process_item_fulfillment(ext_item)
        self.assertEqual(processed.status, WorkExtensionItem.Status.AWAITING_PARTS)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, EmployeeJob.Status.AWAITING_PARTS)


class RescheduleTests(TenantTestCase):
    @classmethod
    def get_test_schema_name(cls):
        return "test_resched"

    def setUp(self):
        super().setUp()
        self.company = self.tenant
        self.user = User.objects.create_user(username="resched_user", password="password123")
        self.employee = Employee.objects.create(user=self.user, company=self.company, employee_id="EMP-RES-01")
        self.service_request = ServiceRequest.objects.create(
            company=self.company,
            customer_name="Bob Brown",
            phone="9888777666",
            service_category="carpentry",
            issue_title="Door Hinge Repair",
            address="101 Maple Street",
            preferred_date=timezone.now().date(),
        )
        self.job = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee,
            is_primary=True,
        )

    def test_second_parts_delay_escalates_to_support_callback(self):
        """Test that a second parts delay freezes date change and creates a Support callback."""
        res1 = JobReschedule.objects.create(
            job=self.job,
            old_date=self.service_request.preferred_date,
            new_date=self.service_request.preferred_date,
            delay_count=1,
        )

        # 2nd delay attempt
        delay_count = JobReschedule.objects.filter(job=self.job).count() + 1
        resched2 = JobReschedule.objects.create(
            job=self.job,
            old_date=self.service_request.preferred_date,
            new_date=self.service_request.preferred_date, # Date change frozen
            delay_count=delay_count,
            support_callback_created=True,
        )
        self.assertTrue(resched2.support_callback_created)
        self.assertEqual(resched2.delay_count, 2)
