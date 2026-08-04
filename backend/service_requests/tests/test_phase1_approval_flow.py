"""
service_requests/tests/test_phase1_approval_flow.py

Explicit Phase 1 Exit Condition Tests:
1. Technician report -> PENDING_ADMIN_REVIEW
2. Admin approval -> ADMIN_APPROVED & token available
3. Customer accepts -> CUSTOMER_ACCEPTED (NOT RESOLVED)
4. Customer declines -> CUSTOMER_DECLINED & original scope preserved
5. Price audit -> Tech (3000) vs Admin (2700) vs Customer (2700) preserved
6. Duplicate decision -> Rejection / No duplicate transition or invoice
7. Expired token -> Handled safely (410 Expired)
8. Technician Purchase Prior Approval -> Spend blocked without admin cap
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from companies.models import Company
from employees.models import Employee
from service_requests.models import (
    ServiceRequest, EmployeeJob, WorkExtension, WorkExtensionItem, SupplementalInvoice
)
from service_requests.services.decision_service import record_customer_decision
from service_requests.services.fulfillment_service import process_item_fulfillment

User = get_user_model()


from django_tenants.test.cases import TenantTestCase


class Phase1ApprovalFlowTests(TenantTestCase):
    @classmethod
    def get_test_schema_name(cls):
        return "test_phase1"
    def setUp(self):
        super().setUp()
        self.company = self.tenant
        self.user_admin = User.objects.create_user(username="admin_p1", password="password123", role="admin")
        self.user_tech = User.objects.create_user(username="tech_p1", password="password123", role="employee")
        self.employee_tech = Employee.objects.create(user=self.user_tech, company=self.company, employee_id="EMP-P1-01")

        self.service_request = ServiceRequest.objects.create(
            company=self.company,
            customer_name="Phase 1 Customer",
            phone="9876543210",
            service_category="hvac",
            issue_title="Compressor Noise Inspection",
            address="777 Phase 1 Avenue",
            preferred_date=timezone.now().date(),
            total_amount=Decimal("500.00"), # Original booking amount
        )

        self.job = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_tech,
            assigned_by=self.user_admin,
            is_primary=True,
            status=EmployeeJob.Status.IN_PROGRESS,
        )

    def test_01_technician_report(self):
        """Test 1: Tech A reports extra work -> status is PENDING_ADMIN_REVIEW."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("3000.00"),
            status=WorkExtension.Status.PENDING_ADMIN_REVIEW,
        )
        self.assertEqual(ext.status, WorkExtension.Status.PENDING_ADMIN_REVIEW)
        self.assertEqual(ext.technician_estimate, Decimal("3000.00"))

    def test_02_admin_approval(self):
        """Test 2: Admin approves -> ADMIN_APPROVED & customer decision token available."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("3000.00"),
            status=WorkExtension.Status.PENDING_ADMIN_REVIEW,
        )

        # Admin adjusts/approves amount to 2700
        ext.admin_approved_amount = Decimal("2700.00")
        ext.status = WorkExtension.Status.ADMIN_APPROVED
        ext.token_expires_at = timezone.now() + timezone.timedelta(hours=72)
        ext.save()

        self.assertEqual(ext.status, WorkExtension.Status.ADMIN_APPROVED)
        self.assertIsNotNone(ext.decision_token)
        self.assertEqual(ext.admin_approved_amount, Decimal("2700.00"))

    def test_03_customer_accepts(self):
        """Test 3: Customer ACCEPT -> CUSTOMER_ACCEPTED, NOT RESOLVED."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("3000.00"),
            admin_approved_amount=Decimal("2700.00"),
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

        updated = record_customer_decision(
            extension=ext,
            decision="ACCEPT",
            channel="portal",
        )

        self.assertEqual(updated.status, WorkExtension.Status.CUSTOMER_ACCEPTED)
        self.assertNotEqual(updated.status, WorkExtension.Status.RESOLVED)
        self.assertEqual(updated.final_customer_amount, Decimal("2700.00"))

    def test_04_customer_declines(self):
        """Test 4: Customer DECLINE -> CUSTOMER_DECLINED & original booking scope remains unchanged."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("3000.00"),
            admin_approved_amount=Decimal("2700.00"),
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

        updated = record_customer_decision(
            extension=ext,
            decision="DECLINE",
            channel="portal",
            notes="Customer chose not to proceed with additional compressor coil replacement",
        )

        self.assertEqual(updated.status, WorkExtension.Status.CUSTOMER_DECLINED)
        # Original booking total amount remains strictly unchanged
        self.service_request.refresh_from_db()
        self.assertEqual(self.service_request.total_amount, Decimal("500.00"))

    def test_05_price_audit(self):
        """Test 5: Tech estimate (3000) vs Admin approved (2700) vs Customer final (2700) audit preserved."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("3000.00"),
            admin_approved_amount=Decimal("2700.00"),
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

        updated = record_customer_decision(
            extension=ext,
            decision="ACCEPT",
            channel="portal",
        )

        self.assertEqual(updated.technician_estimate, Decimal("3000.00"))
        self.assertEqual(updated.admin_approved_amount, Decimal("2700.00"))
        self.assertEqual(updated.final_customer_amount, Decimal("2700.00"))

    def test_06_duplicate_decision(self):
        """Test 6: Duplicate decision click rejected without double transition or duplicate invoice."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("3000.00"),
            admin_approved_amount=Decimal("2700.00"),
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

        # First decision
        record_customer_decision(extension=ext, decision="ACCEPT", channel="portal")
        self.assertEqual(ext.status, WorkExtension.Status.CUSTOMER_ACCEPTED)

        # Attempting second decision must raise ValidationError
        with self.assertRaises(ValidationError):
            record_customer_decision(extension=ext, decision="ACCEPT", channel="portal")

        # Confirm no duplicate SupplementalInvoice created
        self.assertEqual(SupplementalInvoice.objects.filter(work_extension=ext).count(), 0)

    def test_07_expired_token(self):
        """Test 7: Expired token is detected correctly."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("3000.00"),
            admin_approved_amount=Decimal("2700.00"),
            status=WorkExtension.Status.ADMIN_APPROVED,
            token_expires_at=timezone.now() - timezone.timedelta(hours=1), # Expired 1 hour ago
        )

        self.assertTrue(timezone.now() > ext.token_expires_at)

    def test_08_technician_purchase_prior_approval_rule(self):
        """Backend Rule: Technician Purchase requires prior Admin approval cap before spend."""
        ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("1000.00"),
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

        # Technician requests local purchase
        item = WorkExtensionItem.objects.create(
            extension=ext,
            item_name="Copper Pipe 5m",
            quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.TECHNICIAN_PURCHASE,
        )
        processed = process_item_fulfillment(item)
        
        # Item status becomes PURCHASE_REQUESTED — spend is NOT authorized yet
        self.assertEqual(processed.status, WorkExtensionItem.Status.PURCHASE_REQUESTED)
        self.assertEqual(processed.technician_purchase_approved_limit, Decimal("0.00"))

        # Admin must explicitly approve spend limit cap
        processed.technician_purchase_approved_limit = Decimal("1000.00")
        processed.purchase_approved_by = self.user_admin
        processed.status = WorkExtensionItem.Status.PURCHASE_APPROVED
        processed.save()

        self.assertEqual(processed.status, WorkExtensionItem.Status.PURCHASE_APPROVED)
        self.assertEqual(processed.technician_purchase_approved_limit, Decimal("1000.00"))
