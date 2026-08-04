"""
service_requests/services/fulfillment_service.py

Inventory & Material Fulfillment Engine for WorkExtensions.
Handles stock checking, reservations with select_for_update row locking,
proactive replenishment alert triggering, cross-warehouse transfers,
and setting EmployeeJob to AWAITING_PARTS when stock is delayed.
"""
from django.db import transaction
from rest_framework.exceptions import ValidationError

from inventory.models import InventoryItem, InventoryAlert, InventoryTransfer
from time_tracking.models import Location
from ..models import WorkExtensionItem, EmployeeJob


@transaction.atomic
def process_item_fulfillment(extension_item: WorkExtensionItem) -> WorkExtensionItem:
    """
    Processes stock check & fulfillment reservation for a WorkExtensionItem across 5 sourcing paths.
    Uses row-level DB locks to prevent race conditions during reservation.
    Enforces idempotency and cross-tenant inventory isolation.
    """
    # Idempotency guard: If item is already processed, do not repeat reservations or procurement increments
    if extension_item.status in [
        WorkExtensionItem.Status.RESERVED,
        WorkExtensionItem.Status.AWAITING_PARTS,
        WorkExtensionItem.Status.FULFILLED,
        WorkExtensionItem.Status.PURCHASE_APPROVED,
    ]:
        return extension_item

    # Cross-Tenant Isolation Guard
    if extension_item.inventory_item:
        sr_company = extension_item.extension.service_request.company
        if extension_item.inventory_item.org != sr_company:
            raise ValidationError("Forbidden: Cross-organization inventory access is strictly prohibited.")

    source = extension_item.fulfillment_source

    # Path 5: CUSTOMER_SUPPLIED
    if source == WorkExtensionItem.FulfillmentSource.CUSTOMER_SUPPLIED:
        extension_item.status = WorkExtensionItem.Status.PENDING
        extension_item.warranty_covered = False
        extension_item.save()
        return extension_item

    # Path 4: TECHNICIAN_PURCHASE
    if source == WorkExtensionItem.FulfillmentSource.TECHNICIAN_PURCHASE:
        extension_item.status = WorkExtensionItem.Status.PURCHASE_REQUESTED
        extension_item.save()
        return extension_item

    # Path 2: ORGANIZATION_TRANSFER
    if source == WorkExtensionItem.FulfillmentSource.ORGANIZATION_TRANSFER:
        extension_item.status = WorkExtensionItem.Status.AWAITING_PARTS
        extension_item.save()

        # Update attached EmployeeJob to AWAITING_PARTS
        job = extension_item.extension.job
        job.status = EmployeeJob.Status.AWAITING_PARTS
        job.save(update_fields=["status"])

        # Check if item is available at another location and create InventoryTransfer
        if extension_item.inventory_item:
            other_stock = InventoryItem.objects.filter(
                org=extension_item.inventory_item.org,
                sku=extension_item.inventory_item.sku,
            ).exclude(id=extension_item.inventory_item.id).filter(
                total_quantity__gt=0
            ).first()

            if other_stock and other_stock.location and extension_item.location:
                InventoryTransfer.objects.create(
                    item=other_stock,
                    from_location=other_stock.location,
                    to_location=extension_item.location,
                    quantity=extension_item.quantity,
                    requested_by=extension_item.extension.job.assigned_by or extension_item.extension.service_request.customer,
                    status=InventoryTransfer.Status.PENDING,
                )
        return extension_item

    # Path 3: ORGANIZATION_PROCUREMENT
    if source == WorkExtensionItem.FulfillmentSource.ORGANIZATION_PROCUREMENT:
        extension_item.status = WorkExtensionItem.Status.AWAITING_PARTS
        extension_item.save()

        job = extension_item.extension.job
        job.status = EmployeeJob.Status.AWAITING_PARTS
        job.save(update_fields=["status"])

        if extension_item.inventory_item:
            inv_item = extension_item.inventory_item
            inv_item.pending_purchase_quantity += extension_item.quantity
            inv_item.save()

            InventoryAlert.objects.get_or_create(
                org=inv_item.org,
                item=inv_item,
                alert_type=InventoryAlert.AlertType.LOW_STOCK,
                defaults={
                    "message": f"Procurement Request: {extension_item.quantity}x {inv_item.name} required for WorkExtension #{extension_item.extension.id}."
                }
            )
        return extension_item

    # Path 1: ORGANIZATION_STOCK (Local Stock Sourcing with Select For Update Row Lock)
    if extension_item.inventory_item:
        inv_item = InventoryItem.objects.select_for_update().get(id=extension_item.inventory_item.id)
        effective_avail = inv_item.total_quantity - inv_item.reserved_quantity

        if effective_avail >= extension_item.quantity:
            inv_item.reserved_quantity += extension_item.quantity
            inv_item.save()

            extension_item.status = WorkExtensionItem.Status.RESERVED
            extension_item.save()

            # Proactive Replenishment Check: If remaining available <= reorder_threshold
            remaining_avail = inv_item.total_quantity - inv_item.reserved_quantity
            if remaining_avail <= inv_item.reorder_threshold:
                inv_item.pending_purchase_quantity += inv_item.reorder_quantity
                inv_item.save()

                InventoryAlert.objects.get_or_create(
                    org=inv_item.org,
                    item=inv_item,
                    alert_type=InventoryAlert.AlertType.LOW_STOCK,
                    defaults={
                        "message": f"Low Stock Alert: {inv_item.name} (SKU: {inv_item.sku}) has reached reorder threshold ({remaining_avail} remaining, threshold: {inv_item.reorder_threshold}). Auto-triggered procurement recommendation for {inv_item.reorder_quantity} units."
                    }
                )
        else:
            # Stock unavailable locally -> Set AWAITING_PARTS & trigger procurement
            extension_item.status = WorkExtensionItem.Status.AWAITING_PARTS
            extension_item.save()

            job = extension_item.extension.job
            job.status = EmployeeJob.Status.AWAITING_PARTS
            job.save(update_fields=["status"])

            inv_item.pending_purchase_quantity += extension_item.quantity
            inv_item.save()

            InventoryAlert.objects.get_or_create(
                org=inv_item.org,
                item=inv_item,
                alert_type=InventoryAlert.AlertType.LOW_STOCK,
                defaults={
                    "message": f"Stock Shortage: WorkExtension #{extension_item.extension.id} requires {extension_item.quantity}x {inv_item.name}, but only {effective_avail} available. Procurement/Transfer required."
                }
            )

    return extension_item
