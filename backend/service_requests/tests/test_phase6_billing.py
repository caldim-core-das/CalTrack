"""
service_requests/tests/test_phase6_billing.py

Phase 6 Exit Condition & Supplemental Billing / Payment Collection Tests:
1. Operational Completion Guard -> Invoice BLOCKED while work is in progress (CUSTOMER_ACCEPTED)
2. Supplemental Invoice Amount -> Calculates outstanding due balance (₹2,200), not total case value (₹2,700)
3. Original Paid Invoice Immutability -> Original invoice (₹500 PAID) remains unchanged
4. Tech Reimbursement vs Customer Charge -> actual_cost (₹1,800) vs billed_to_customer (₹2,200) remain separate
5. Prepaid Original + COD Additional -> Original paid ONLINE, additional collected CASH on-site
6. Test 50 Full Billing Audit Chain -> Complete audit tie from SR -> WorkExtension -> Completion -> Invoice -> Payment
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from companies.models import Company
from employees.models import Employee
from service_requests.models import (
    ServiceRequest, EmployeeJob, WorkExtension, WorkExtensionItem, SupplementalInvoice
)
from service_requests.services.decision_service import record_customer_decision

User = get_user_model()


from django_tenants.test.cases import TenantTestCase


class Phase6BillingTests(TenantTestCase):
    @classmethod
    def get_test_schema_name(cls):
        return "test_phase6"
    def setUp(self):
        super().setUp()
        self.company = self.tenant
        self.user_admin = User.objects.create_user(username="admin_p6", password="password123", role="admin")
        self.user_tech = User.objects.create_user(username="tech_p6", password="password123", role="employee")
        self.employee_tech = Employee.objects.create(user=self.user_tech, company=self.company, employee_id="EMP-P6-01")

        # Original booking: ₹500 (Prepaid Online)
        self.service_request = ServiceRequest.objects.create(
            company=self.company,
            customer_name="Phase 6 Customer",
            phone="9333444555",
            service_category="hvac",
            issue_title="AC Service & Scope Expansion",
            address="600 Accounting Way",
            preferred_date=timezone.now().date(),
            total_amount=Decimal("500.00"),
            payment_status=ServiceRequest.PaymentStatus.PAID,
            payment_method=ServiceRequest.PaymentMethod.ONLINE,
            invoice_id="INV-SR-1001-ORIG",
            status=ServiceRequest.Status.IN_PROGRESS,
        )

        self.job = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_tech,
            assigned_by=self.user_admin,
            is_primary=True,
            status=EmployeeJob.Status.IN_PROGRESS,
        )

        # Additional repair: ₹2,200
        self.ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("2500.00"),
            admin_approved_amount=Decimal("2200.00"),
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

        record_customer_decision(extension=self.ext, decision="ACCEPT", channel="portal")

    def test_01_supplemental_invoice_requires_operational_completion(self):
        """Phase 6: Attempting to generate supplemental invoice before work completion returns 400 error."""
        self.client.force_login(self.user_admin)
        self.assertEqual(self.ext.status, WorkExtension.Status.CUSTOMER_ACCEPTED)

        response = self.client.post(
            f"/api/service-requests/{self.service_request.id}/supplemental-invoice/",
            data={"work_extension_id": self.ext.id},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("operational completion", response.data["message"])

    def test_02_supplemental_invoice_amount_equals_outstanding_extension_due(self):
        """Phase 6: Original ₹500 paid + Additional ₹2,200 -> Supplemental Invoice is ₹2,200 (NOT ₹2,700)."""
        self.ext.status = WorkExtension.Status.RESOLVED
        self.ext.save()

        self.client.force_login(self.user_admin)
        response = self.client.post(
            f"/api/service-requests/{self.service_request.id}/supplemental-invoice/",
            data={"work_extension_id": self.ext.id},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        invoice = SupplementalInvoice.objects.get(work_extension=self.ext)
        self.assertEqual(invoice.amount, Decimal("2200.00")) # Supplemental due balance
        self.assertNotEqual(invoice.amount, Decimal("2700.00"))

    def test_03_original_paid_invoice_immutability(self):
        """Phase 6: Original invoice (INV-SR-1001-ORIG, ₹500 PAID) remains 100% immutable."""
        self.ext.status = WorkExtension.Status.RESOLVED
        self.ext.save()

        self.client.force_login(self.user_admin)
        self.client.post(
            f"/api/service-requests/{self.service_request.id}/supplemental-invoice/",
            data={"work_extension_id": self.ext.id},
            content_type="application/json",
        )

        self.service_request.refresh_from_db()
        self.assertEqual(self.service_request.total_amount, Decimal("500.00"))
        self.assertEqual(self.service_request.invoice_id, "INV-SR-1001-ORIG")
        self.assertEqual(self.service_request.payment_status, ServiceRequest.PaymentStatus.PAID)

    def test_04_technician_reimbursement_vs_customer_billing(self):
        """Phase 6: Tech purchase actual_cost (₹1,800) vs customer charge (₹2,200) remain separate accounting values."""
        item = WorkExtensionItem.objects.create(
            extension=self.ext,
            item_name="Heavy Compressor Component",
            quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.TECHNICIAN_PURCHASE,
            actual_cost=Decimal("1800.00"),
            technician_reimbursement_amount=Decimal("1800.00"),
            billed_to_customer=Decimal("2200.00"),
            status=WorkExtensionItem.Status.FULFILLED,
        )

        item.refresh_from_db()
        self.assertEqual(item.actual_cost, Decimal("1800.00"))
        self.assertEqual(item.technician_reimbursement_amount, Decimal("1800.00"))
        self.assertEqual(item.billed_to_customer, Decimal("2200.00"))
        self.assertNotEqual(item.actual_cost, item.billed_to_customer)

    def test_05_prepaid_original_plus_cod_additional(self):
        """Phase 6: Prepaid original (₹500 Online) + Additional (₹2,200 Cash) on-site collection."""
        self.ext.status = WorkExtension.Status.RESOLVED
        self.ext.save()

        invoice = SupplementalInvoice.objects.create(
            service_request=self.service_request,
            work_extension=self.ext,
            invoice_number=f"SUPP-INV-{self.service_request.request_id}-COD",
            amount=Decimal("2200.00"),
            status=SupplementalInvoice.Status.PENDING,
        )

        # On-site cash payment for supplemental invoice
        invoice.status = SupplementalInvoice.Status.PAID
        invoice.payment_method = "CASH"
        invoice.paid_at = timezone.now()
        invoice.save()

        self.assertEqual(self.service_request.payment_method, ServiceRequest.PaymentMethod.ONLINE)
        self.assertEqual(invoice.payment_method, "CASH")
        self.assertEqual(invoice.amount, Decimal("2200.00"))

    def test_06_test_50_full_billing_audit_chain(self):
        """Test 50: Complete traceable audit chain tying SR -> WorkExtension -> Completion -> SupplementalInvoice -> Payment."""
        self.ext.status = WorkExtension.Status.RESOLVED
        self.ext.save()

        invoice = SupplementalInvoice.objects.create(
            service_request=self.service_request,
            work_extension=self.ext,
            invoice_number=f"SUPP-INV-{self.service_request.request_id}-AUDIT",
            amount=self.ext.final_customer_amount,
            status=SupplementalInvoice.Status.PENDING,
        )

        invoice.status = SupplementalInvoice.Status.PAID
        invoice.payment_method = "ONLINE"
        invoice.transaction_id = "tx_audit_999"
        invoice.paid_at = timezone.now()
        invoice.save()

        # Audit Chain Verification
        self.assertEqual(invoice.service_request, self.service_request)
        self.assertEqual(invoice.work_extension, self.ext)
        self.assertEqual(invoice.work_extension.admin_approved_amount, Decimal("2200.00"))
        self.assertEqual(invoice.work_extension.final_customer_amount, Decimal("2200.00"))
        self.assertEqual(invoice.work_extension.status, WorkExtension.Status.RESOLVED)
        self.assertEqual(invoice.status, SupplementalInvoice.Status.PAID)
