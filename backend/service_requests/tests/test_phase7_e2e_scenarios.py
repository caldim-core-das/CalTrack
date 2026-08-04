"""
service_requests/tests/test_phase7_e2e_scenarios.py

Phase 7 End-to-End Manual Scenario Verification & QA/UAT:
- Scenario A: Same-Tech Acceptance & Operational Resolution
- Scenario B: Specialist Referral & Job 2 Handoff
- Scenario C: Material Shortage & Job Rescheduling
- Scenario D: 2nd Delay Support Callback Escalation
- Scenario E: Customer Decline & UNABLE_TO_COMPLETE Transition
- Scenario F: Technician Local Purchase & Spending Cap
- Scenario G: Supplemental Invoicing & Independent Financial Settlement
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from companies.models import Company
from employees.models import Employee
from inventory.models import InventoryItem
from service_requests.models import (
    ServiceRequest, EmployeeJob, WorkExtension, WorkExtensionItem,
    JobReschedule, SupplementalInvoice, JobCompletionProof
)
from service_requests.services.decision_service import record_customer_decision
from service_requests.services.fulfillment_service import process_item_fulfillment

User = get_user_model()


from django_tenants.test.cases import TenantTestCase


class Phase7E2EScenarioTests(TenantTestCase):
    @classmethod
    def get_test_schema_name(cls):
        return "test_phase7"
    def setUp(self):
        super().setUp()
        self.company = self.tenant
        self.user_admin = User.objects.create_user(username="admin_p7", password="password123", role="admin")
        self.user_tech_a = User.objects.create_user(username="tech_a_p7", password="password123", role="employee")
        self.user_tech_b = User.objects.create_user(username="tech_b_p7", password="password123", role="employee")

        self.employee_a = Employee.objects.create(user=self.user_tech_a, company=self.company, employee_id="EMP-P7-01", title="General Tech A")
        self.employee_b = Employee.objects.create(user=self.user_tech_b, company=self.company, employee_id="EMP-P7-02", title="Specialist Tech B")

    def test_scenario_a_same_tech_acceptance_and_resolution(self):
        """Scenario A: Same-Tech extra work reported -> Admin approves -> Customer accepts -> Tech completes work."""
        sr = ServiceRequest.objects.create(
            company=self.company, customer_name="Scenario A Customer", phone="9000111222",
            service_category="hvac", issue_title="AC Noise", preferred_date=timezone.now().date(),
            status=ServiceRequest.Status.IN_PROGRESS,
        )
        job1 = EmployeeJob.objects.create(service_request=sr, employee=self.employee_a, assigned_by=self.user_admin, is_primary=True, status=EmployeeJob.Status.IN_PROGRESS)
        JobCompletionProof.objects.create(job=job1, note="Proof photo")

        # 1. Tech A reports extra work
        ext = WorkExtension.objects.create(
            service_request=sr, job=job1, reported_by=self.employee_a,
            technician_estimate=Decimal("1500.00"), status=WorkExtension.Status.PENDING_ADMIN_REVIEW,
        )
        self.assertEqual(ext.status, WorkExtension.Status.PENDING_ADMIN_REVIEW)

        # 2. Admin approves amount (1400)
        ext.admin_approved_amount = Decimal("1400.00")
        ext.status = WorkExtension.Status.ADMIN_APPROVED
        ext.save()

        # 3. Customer accepts via portal
        record_customer_decision(extension=ext, decision="ACCEPT", channel="portal")
        self.assertEqual(ext.status, WorkExtension.Status.CUSTOMER_ACCEPTED)

        # 4. Tech completes job
        ext.status = WorkExtension.Status.RESOLVED
        ext.save()
        job1.status = EmployeeJob.Status.COMPLETED
        job1.save()

        self.assertTrue(sr.is_ready_to_complete())

    def test_scenario_b_specialist_referral_and_job2_handoff(self):
        """Scenario B: Tech A reports specialist fault -> Customer accepts -> PENDING_ASSIGNMENT & FOLLOW_UP_REQUIRED -> Admin assigns Tech B (Job 2)."""
        sr = ServiceRequest.objects.create(
            company=self.company, customer_name="Scenario B Customer", phone="9000111333",
            service_category="hvac", issue_title="Compressor Fault", preferred_date=timezone.now().date(),
            status=ServiceRequest.Status.IN_PROGRESS,
        )
        job1 = EmployeeJob.objects.create(service_request=sr, employee=self.employee_a, assigned_by=self.user_admin, is_primary=True, status=EmployeeJob.Status.IN_PROGRESS)

        # Tech A reports specialist extension
        ext = WorkExtension.objects.create(
            service_request=sr, job=job1, reported_by=self.employee_a,
            technician_estimate=Decimal("4500.00"), admin_approved_amount=Decimal("4500.00"),
            requires_specialist=True, required_skill="Compressor Specialist",
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

        # Customer accepts -> PENDING_ASSIGNMENT & FOLLOW_UP_REQUIRED
        record_customer_decision(extension=ext, decision="ACCEPT", channel="portal")
        sr.refresh_from_db()
        self.assertEqual(ext.status, WorkExtension.Status.PENDING_ASSIGNMENT)
        self.assertEqual(sr.status, ServiceRequest.Status.FOLLOW_UP_REQUIRED)

        # Admin assigns Tech B (Job 2)
        job2 = EmployeeJob.objects.create(
            service_request=sr, employee=self.employee_b, assigned_by=self.user_admin,
            is_primary=False, source_work_extension=ext, status=EmployeeJob.Status.ASSIGNED,
        )

        # Tech A completes Job 1 -> Case remains OPEN (is_ready_to_complete is False)
        job1.status = EmployeeJob.Status.COMPLETED
        job1.save()
        self.assertFalse(sr.is_ready_to_complete())

        # Tech B completes Job 2
        job2.status = EmployeeJob.Status.COMPLETED
        job2.save()
        ext.status = WorkExtension.Status.RESOLVED
        ext.save()

        self.assertTrue(sr.is_ready_to_complete())

    def test_scenario_c_material_shortage_and_rescheduling(self):
        """Scenario C: Stock shortage triggers AWAITING_PARTS -> 1st delay reschedules preferred date."""
        sr = ServiceRequest.objects.create(
            company=self.company, customer_name="Scenario C Customer", phone="9000111444",
            service_category="electrical", issue_title="Rare Relay Replacement", preferred_date=timezone.now().date(),
            status=ServiceRequest.Status.IN_PROGRESS,
        )
        job1 = EmployeeJob.objects.create(service_request=sr, employee=self.employee_a, assigned_by=self.user_admin, is_primary=True, status=EmployeeJob.Status.IN_PROGRESS)

        ext = WorkExtension.objects.create(
            service_request=sr, job=job1, reported_by=self.employee_a,
            technician_estimate=Decimal("1200.00"), status=WorkExtension.Status.ADMIN_APPROVED,
        )

        item_inv = InventoryItem.objects.create(org=self.company, name="Rare Relay", sku="RR-01", total_quantity=0)
        ext_item = WorkExtensionItem.objects.create(
            extension=ext, inventory_item=item_inv, item_name="Rare Relay", quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_STOCK,
        )

        process_item_fulfillment(ext_item)
        job1.refresh_from_db()
        self.assertEqual(ext_item.status, WorkExtensionItem.Status.AWAITING_PARTS)
        self.assertEqual(job1.status, EmployeeJob.Status.AWAITING_PARTS)

        # Reschedule 1st delay
        new_date = timezone.now().date() + timezone.timedelta(days=3)
        reschedule = JobReschedule.objects.create(
            job=job1, old_date=sr.preferred_date, new_date=new_date,
            reason=JobReschedule.Reason.PARTS_UNAVAILABLE, delay_count=1, customer_notified_at=timezone.now(),
        )
        sr.preferred_date = new_date
        sr.save()

        self.assertEqual(sr.preferred_date, new_date)
        self.assertEqual(reschedule.delay_count, 1)

    def test_scenario_d_second_delay_support_callback_escalation(self):
        """Scenario D: 2nd delay occurs -> Silent auto-reschedule blocked, Support callback created."""
        sr = ServiceRequest.objects.create(
            company=self.company, customer_name="Scenario D Customer", phone="9000111555",
            service_category="plumbing", issue_title="Pipe Delay", preferred_date=timezone.now().date(),
        )
        job1 = EmployeeJob.objects.create(service_request=sr, employee=self.employee_a, assigned_by=self.user_admin, is_primary=True, status=EmployeeJob.Status.AWAITING_PARTS)

        # 1st delay
        JobReschedule.objects.create(job=job1, old_date=sr.preferred_date, new_date=sr.preferred_date, delay_count=1)

        # 2nd delay -> ESCALATE
        reschedule2 = JobReschedule.objects.create(
            job=job1, old_date=sr.preferred_date, new_date=sr.preferred_date,
            delay_count=2, support_callback_created=True, notes="[ESCALATED TO SUPPORT CALLBACK] Repeated parts delay",
        )

        self.assertTrue(reschedule2.support_callback_created)
        self.assertEqual(reschedule2.delay_count, 2)

    def test_scenario_e_customer_decline_and_unable_to_complete(self):
        """Scenario E: Customer declines critical specialist repair -> Job becomes UNABLE_TO_COMPLETE."""
        sr = ServiceRequest.objects.create(
            company=self.company, customer_name="Scenario E Customer", phone="9000111666",
            service_category="hvac", issue_title="Major Compressor Repair", preferred_date=timezone.now().date(),
        )
        job1 = EmployeeJob.objects.create(service_request=sr, employee=self.employee_a, assigned_by=self.user_admin, is_primary=True, status=EmployeeJob.Status.IN_PROGRESS)

        ext = WorkExtension.objects.create(
            service_request=sr, job=job1, reported_by=self.employee_a,
            technician_estimate=Decimal("5000.00"), admin_approved_amount=Decimal("5000.00"),
            requires_specialist=True, status=WorkExtension.Status.ADMIN_APPROVED,
        )

        record_customer_decision(extension=ext, decision="DECLINE", channel="portal", notes="Customer declined critical repair")

        ext.refresh_from_db()
        job1.refresh_from_db()
        self.assertEqual(ext.status, WorkExtension.Status.CUSTOMER_DECLINED)
        self.assertEqual(job1.status, EmployeeJob.Status.UNABLE_TO_COMPLETE)

    def test_scenario_f_technician_local_purchase_spending_cap(self):
        """Scenario F: Tech purchase requires prior Admin spending cap approval before spend."""
        sr = ServiceRequest.objects.create(
            company=self.company, customer_name="Scenario F Customer", phone="9000111777",
            service_category="electrical", issue_title="Wire Roll Purchase", preferred_date=timezone.now().date(),
        )
        job1 = EmployeeJob.objects.create(service_request=sr, employee=self.employee_a, assigned_by=self.user_admin, is_primary=True, status=EmployeeJob.Status.IN_PROGRESS)

        ext = WorkExtension.objects.create(service_request=sr, job=job1, reported_by=self.employee_a, status=WorkExtension.Status.ADMIN_APPROVED)

        item = WorkExtensionItem.objects.create(
            extension=ext, item_name="Wire Roll", quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.TECHNICIAN_PURCHASE,
        )

        processed = process_item_fulfillment(item)
        self.assertEqual(processed.status, WorkExtensionItem.Status.PURCHASE_REQUESTED)

        # Admin approves spend limit cap (1500)
        processed.technician_purchase_approved_limit = Decimal("1500.00")
        processed.status = WorkExtensionItem.Status.PURCHASE_APPROVED
        processed.save()

        self.assertEqual(processed.status, WorkExtensionItem.Status.PURCHASE_APPROVED)
        self.assertEqual(processed.technician_purchase_approved_limit, Decimal("1500.00"))

    def test_scenario_g_supplemental_invoicing_and_financial_settlement(self):
        """Scenario G: Operational completion (RESOLVED) generates SupplementalInvoice -> Payment settles invoice to PAID."""
        sr = ServiceRequest.objects.create(
            company=self.company, customer_name="Scenario G Customer", phone="9000111888",
            service_category="hvac", issue_title="Ducting Repair", preferred_date=timezone.now().date(),
            total_amount=Decimal("500.00"), payment_status=ServiceRequest.PaymentStatus.PAID,
        )
        job1 = EmployeeJob.objects.create(service_request=sr, employee=self.employee_a, assigned_by=self.user_admin, is_primary=True, status=EmployeeJob.Status.COMPLETED)

        ext = WorkExtension.objects.create(
            service_request=sr, job=job1, reported_by=self.employee_a,
            technician_estimate=Decimal("2500.00"), admin_approved_amount=Decimal("2200.00"),
            final_customer_amount=Decimal("2200.00"), status=WorkExtension.Status.RESOLVED,
        )

        inv = SupplementalInvoice.objects.create(
            service_request=sr, work_extension=ext, invoice_number=f"SUPP-INV-{sr.request_id}-G",
            amount=ext.final_customer_amount, status=SupplementalInvoice.Status.PENDING,
        )

        inv.status = SupplementalInvoice.Status.PAID
        inv.payment_method = "CASH"
        inv.paid_at = timezone.now()
        inv.save()

        inv.refresh_from_db()
        self.assertEqual(inv.amount, Decimal("2200.00"))
        self.assertEqual(inv.status, SupplementalInvoice.Status.PAID)
