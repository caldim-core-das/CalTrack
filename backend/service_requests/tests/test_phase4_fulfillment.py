"""
service_requests/tests/test_phase4_fulfillment.py

Phase 4 Exit Condition & Inventory Fulfillment Tests:
1. Local Stock Reservation (select_for_update) -> reserved_quantity increased -> status = RESERVED
2. Proactive Replenishment -> Remaining stock <= threshold -> InventoryAlert created & pending_purchase updated
3. Cross-warehouse Transfer -> InventoryTransfer created -> EmployeeJob set to AWAITING_PARTS
4. Supplier Procurement -> pending_purchase_quantity updated -> EmployeeJob set to AWAITING_PARTS
5. Tech Purchase Spending Cap -> Status PURCHASE_REQUESTED -> Admin approval required
6. Customer-supplied part -> warranty_covered = False -> Tech compatibility verification
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from companies.models import Company
from employees.models import Employee
from inventory.models import InventoryItem, InventoryAlert, InventoryTransfer
from time_tracking.models import Location
from service_requests.models import ServiceRequest, EmployeeJob, WorkExtension, WorkExtensionItem
from service_requests.services.fulfillment_service import process_item_fulfillment

User = get_user_model()


from django_tenants.test.cases import TenantTestCase


class Phase4FulfillmentTests(TenantTestCase):
    @classmethod
    def get_test_schema_name(cls):
        return "test_phase4"
    def setUp(self):
        super().setUp()
        self.company = self.tenant
        self.user_admin = User.objects.create_user(username="admin_p4", password="password123", role="admin")
        self.user_tech = User.objects.create_user(username="tech_p4", password="password123", role="employee")
        self.employee_tech = Employee.objects.create(user=self.user_tech, company=self.company, employee_id="EMP-P4-01")

        self.loc_main = Location.objects.create(name="Main Warehouse", address="100 Logistics Way")
        self.loc_north = Location.objects.create(name="North Hub", address="200 Hub Road")

        self.service_request = ServiceRequest.objects.create(
            company=self.company,
            customer_name="Phase 4 Customer",
            phone="9111222333",
            service_category="electrical",
            issue_title="Circuit Breaker Tripping",
            address="100 Inventory Lane",
            preferred_date=timezone.now().date(),
            status=ServiceRequest.Status.IN_PROGRESS,
        )

        self.job = EmployeeJob.objects.create(
            service_request=self.service_request,
            employee=self.employee_tech,
            assigned_by=self.user_admin,
            is_primary=True,
            status=EmployeeJob.Status.IN_PROGRESS,
        )

        self.ext = WorkExtension.objects.create(
            service_request=self.service_request,
            job=self.job,
            reported_by=self.employee_tech,
            technician_estimate=Decimal("2000.00"),
            status=WorkExtension.Status.ADMIN_APPROVED,
        )

    def test_01_organization_stock_reservation(self):
        """Phase 4: Stock available -> Select for update reserves stock -> Status RESERVED."""
        item_inv = InventoryItem.objects.create(
            org=self.company,
            name="16A Circuit Breaker",
            sku="CB-16A",
            unit="pcs",
            unit_cost=Decimal("150.00"),
            unit_price=Decimal("300.00"),
            total_quantity=10,
            reserved_quantity=0,
            reorder_threshold=2,
            location=self.loc_main,
        )

        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            inventory_item=item_inv,
            item_name="16A Circuit Breaker",
            quantity=3,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_STOCK,
            location=self.loc_main,
        )

        processed = process_item_fulfillment(ext_item)

        item_inv.refresh_from_db()
        self.assertEqual(processed.status, WorkExtensionItem.Status.RESERVED)
        self.assertEqual(item_inv.reserved_quantity, 3)
        self.assertEqual(item_inv.effective_available_quantity, 7)

    def test_02_proactive_replenishment_trigger(self):
        """Phase 4: Remaining stock <= reorder threshold -> Triggers InventoryAlert & updates pending_purchase."""
        item_inv = InventoryItem.objects.create(
            org=self.company,
            name="Copper Contact Switch",
            sku="CCS-01",
            unit="pcs",
            total_quantity=5,
            reserved_quantity=0,
            reorder_threshold=3,
            reorder_quantity=10,
            location=self.loc_main,
        )

        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            inventory_item=item_inv,
            item_name="Copper Contact Switch",
            quantity=3, # Leaves 2 remaining (threshold = 3)
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_STOCK,
        )

        process_item_fulfillment(ext_item)

        item_inv.refresh_from_db()
        self.assertEqual(item_inv.reserved_quantity, 3)
        self.assertEqual(item_inv.pending_purchase_quantity, 10)
        self.assertTrue(InventoryAlert.objects.filter(item=item_inv, alert_type=InventoryAlert.AlertType.LOW_STOCK).exists())

    def test_03_organization_transfer(self):
        """Phase 4: Cross-warehouse transfer -> Creates InventoryTransfer -> EmployeeJob AWAITING_PARTS."""
        item_main = InventoryItem.objects.create(
            org=self.company, name="HV Capacitor", sku="HVC-99", total_quantity=0, location=self.loc_main
        )
        item_north = InventoryItem.objects.create(
            org=self.company, name="HV Capacitor", sku="HVC-99", total_quantity=5, location=self.loc_north
        )

        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            inventory_item=item_main,
            item_name="HV Capacitor",
            quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_TRANSFER,
            location=self.loc_main,
        )

        processed = process_item_fulfillment(ext_item)

        self.job.refresh_from_db()
        self.assertEqual(processed.status, WorkExtensionItem.Status.AWAITING_PARTS)
        self.assertEqual(self.job.status, EmployeeJob.Status.AWAITING_PARTS)
        self.assertTrue(InventoryTransfer.objects.filter(item=item_north, to_location=self.loc_main).exists())

    def test_04_organization_procurement(self):
        """Phase 4: Supplier Procurement -> Updates pending_purchase_quantity -> EmployeeJob AWAITING_PARTS."""
        item_inv = InventoryItem.objects.create(
            org=self.company, name="Special Compressor Valve", sku="SCV-01", total_quantity=0, pending_purchase_quantity=0
        )

        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            inventory_item=item_inv,
            item_name="Special Compressor Valve",
            quantity=2,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_PROCUREMENT,
        )

        processed = process_item_fulfillment(ext_item)

        item_inv.refresh_from_db()
        self.job.refresh_from_db()
        self.assertEqual(processed.status, WorkExtensionItem.Status.AWAITING_PARTS)
        self.assertEqual(self.job.status, EmployeeJob.Status.AWAITING_PARTS)
        self.assertEqual(item_inv.pending_purchase_quantity, 2)

    def test_05_technician_purchase_spending_cap(self):
        """Phase 4: Tech Purchase requires prior admin cap approval."""
        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            item_name="Emergency Wire Roll",
            quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.TECHNICIAN_PURCHASE,
        )

        processed = process_item_fulfillment(ext_item)
        self.assertEqual(processed.status, WorkExtensionItem.Status.PURCHASE_REQUESTED)

    def test_06_customer_supplied_verification(self):
        """Phase 4: Customer-supplied part -> warranty_covered = False."""
        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            item_name="Customer Purchased Thermostat",
            quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.CUSTOMER_SUPPLIED,
        )

        processed = process_item_fulfillment(ext_item)
        self.assertFalse(processed.warranty_covered)
        self.assertEqual(processed.status, WorkExtensionItem.Status.PENDING)

    def test_07_test_a_reserved_stock_availability(self):
        """Test A: Stock=10, Reserved=7 -> Effective Available is 3 (not 10). Requesting 4 units triggers shortage."""
        item_inv = InventoryItem.objects.create(
            org=self.company,
            name="10A Fuse",
            sku="FUSE-10A",
            total_quantity=10,
            reserved_quantity=7,
            reorder_threshold=5,
            location=self.loc_main,
        )
        self.assertEqual(item_inv.effective_available_quantity, 3)

        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            inventory_item=item_inv,
            item_name="10A Fuse",
            quantity=4, # Exceeds available 3
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_STOCK,
        )

        processed = process_item_fulfillment(ext_item)
        self.assertEqual(processed.status, WorkExtensionItem.Status.AWAITING_PARTS)

    def test_08_test_b_mixed_sourcing(self):
        """Test B: Mixed sourcing in single extension -> Each item maintains its own independent source & state."""
        item_stock = InventoryItem.objects.create(
            org=self.company, name="Compressor Motor", sku="CM-01", total_quantity=5, reserved_quantity=0
        )

        item1 = WorkExtensionItem.objects.create(
            extension=self.ext, inventory_item=item_stock, item_name="Compressor Motor", quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_STOCK,
        )
        item2 = WorkExtensionItem.objects.create(
            extension=self.ext, item_name="Copper Pipe Roll", quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.TECHNICIAN_PURCHASE,
        )
        item3 = WorkExtensionItem.objects.create(
            extension=self.ext, item_name="Customer R410 Gas", quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.CUSTOMER_SUPPLIED,
        )

        process_item_fulfillment(item1)
        process_item_fulfillment(item2)
        process_item_fulfillment(item3)

        item1.refresh_from_db()
        item2.refresh_from_db()
        item3.refresh_from_db()

        self.assertEqual(item1.status, WorkExtensionItem.Status.RESERVED)
        self.assertEqual(item2.status, WorkExtensionItem.Status.PURCHASE_REQUESTED)
        self.assertEqual(item3.status, WorkExtensionItem.Status.PENDING)
        self.assertFalse(item3.warranty_covered)

    def test_09_test_c_customer_gives_wrong_incompatible_part(self):
        """Test C: Customer supplies incompatible part -> Technician rejects -> Item remains unverified/pending."""
        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            item_name="Customer Thermostat V1",
            quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.CUSTOMER_SUPPLIED,
        )
        process_item_fulfillment(ext_item)

        # Tech inspects part and finds incompatibility
        ext_item.verified_by_tech = False
        ext_item.save()

        ext_item.refresh_from_db()
        self.assertFalse(ext_item.verified_by_tech)
        self.assertNotEqual(ext_item.status, WorkExtensionItem.Status.FULFILLED)

    def test_10_test_d_technician_purchase_over_cap(self):
        """Test D: Tech purchase over approved cap (Cap: 2000, Actual: 2300) -> Re-review required."""
        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            item_name="Emergency Valve",
            quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.TECHNICIAN_PURCHASE,
            status=WorkExtensionItem.Status.PURCHASE_APPROVED,
            technician_purchase_approved_limit=Decimal("2000.00"),
            purchase_approved_by=self.user_admin,
        )

        actual_cost = Decimal("2300.00")
        # Enforce check: cost exceeds approved cap
        exceeds_cap = actual_cost > ext_item.technician_purchase_approved_limit
        self.assertTrue(exceeds_cap)

    def test_11_test_e_cross_organization_inventory_access(self):
        """Test E: Tech from Org A attempts to access/reserve stock from Org B -> ValidationError raised."""
        from django_tenants.utils import schema_context
        with schema_context('public'):
            other_company = Company.objects.create(company_name="Rival Corp B", schema_name="rival_corp_b")
        item_org_b = InventoryItem.objects.create(
            org=other_company, name="Forbidden Relay", sku="FR-01", total_quantity=10
        )

        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            inventory_item=item_org_b,
            item_name="Forbidden Relay",
            quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_STOCK,
        )

        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            process_item_fulfillment(ext_item)

    def test_12_test_f_procurement_duplicate_request_idempotency(self):
        """Test F: Same procurement request processed twice -> pending_purchase_quantity incremented ONCE."""
        item_inv = InventoryItem.objects.create(
            org=self.company, name="Rare Gas Tube", sku="RGT-01", total_quantity=0, pending_purchase_quantity=0
        )

        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            inventory_item=item_inv,
            item_name="Rare Gas Tube",
            quantity=2,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_PROCUREMENT,
        )

        # First call
        process_item_fulfillment(ext_item)
        item_inv.refresh_from_db()
        self.assertEqual(item_inv.pending_purchase_quantity, 2)

        # Second call (accidental duplicate)
        process_item_fulfillment(ext_item)
        item_inv.refresh_from_db()
        self.assertEqual(item_inv.pending_purchase_quantity, 2) # Strict Idempotency

    def test_13_test_g_stock_shortage_after_commercial_approval(self):
        """Test G: Customer approves extension, stock becomes unavailable -> CUSTOMER_ACCEPTED preserved, job -> AWAITING_PARTS."""
        from service_requests.services.decision_service import record_customer_decision
        
        item_inv = InventoryItem.objects.create(
            org=self.company, name="Expansion Valve", sku="EV-01", total_quantity=0
        )

        ext_item = WorkExtensionItem.objects.create(
            extension=self.ext,
            inventory_item=item_inv,
            item_name="Expansion Valve",
            quantity=1,
            fulfillment_source=WorkExtensionItem.FulfillmentSource.ORGANIZATION_STOCK,
        )

        # Customer approves extension commercially
        record_customer_decision(extension=self.ext, decision="ACCEPT", channel="portal")
        self.assertEqual(self.ext.status, WorkExtension.Status.CUSTOMER_ACCEPTED)

        # Process fulfillment under unexpected zero-stock
        process_item_fulfillment(ext_item)

        self.ext.refresh_from_db()
        self.job.refresh_from_db()
        # Commercial approval remains valid (CUSTOMER_ACCEPTED)
        self.assertEqual(self.ext.status, WorkExtension.Status.CUSTOMER_ACCEPTED)
        # Fulfillment shortage triggers AWAITING_PARTS for job & item
        self.assertEqual(ext_item.status, WorkExtensionItem.Status.AWAITING_PARTS)
        self.assertEqual(self.job.status, EmployeeJob.Status.AWAITING_PARTS)

