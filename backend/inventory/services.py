from django.utils import timezone
from rest_framework.exceptions import ValidationError
from inventory.models import InventoryItem, InventoryIssuance, InventoryAlert, InventoryTransfer
from tasks.models import Task
from compliance.models import AuditLog
from time_tracking.models import EmployeeLocation

def check_stock_level(item):
    """Check if stock fell below reorder threshold and create alert."""
    if item.available_quantity < item.reorder_threshold:
        alert, created = InventoryAlert.objects.get_or_create(
            org=item.org,
            alert_type=InventoryAlert.AlertType.LOW_STOCK,
            item=item,
            is_resolved=False,
            defaults={'message': f'Stock for {item.name} is low ({item.available_quantity} available).'}
        )

def issue_inventory(item, employee, issued_by, quantity=1, expected_return_date=None, linked_shift=None, linked_task=None, notes="", condition_on_issue=InventoryIssuance.Condition.GOOD, photo_proof=None):
    if quantity > item.available_quantity:
        raise ValidationError(f"Quantity requested ({quantity}) exceeds available quantity ({item.available_quantity}) for {item.name}")
    
    item.available_quantity -= quantity
    item.save(update_fields=['available_quantity'])
    
    issuance = InventoryIssuance.objects.create(
        org=item.org,
        item=item,
        employee=employee,
        issued_by=issued_by,
        quantity=quantity,
        expected_return_date=expected_return_date,
        linked_shift=linked_shift,
        linked_task=linked_task,
        notes=notes,
        condition_on_issue=condition_on_issue,
        photo_proof=photo_proof
    )
    
    check_stock_level(item)
    return issuance

def return_inventory(issuance, returned_by_user, condition_on_return, notes=""):
    if issuance.returned_at:
        raise ValidationError("This issuance has already been returned.")

    issuance.returned_at = timezone.now()
    issuance.condition_on_return = condition_on_return
    if notes:
        issuance.notes = f"{issuance.notes}\nReturn notes: {notes}"
    
    # Check if damaged
    if condition_on_return == InventoryIssuance.Condition.DAMAGED:
        issuance.deduction_flagged = True
        # Create an alert
        InventoryAlert.objects.create(
            org=issuance.org,
            alert_type=InventoryAlert.AlertType.DAMAGE_REPORTED,
            item=issuance.item,
            employee=issuance.employee,
            message=f"Item {issuance.item.name} was returned damaged by {issuance.employee.employee_id}."
        )
        # We need an AuditLog entry for compliance.
        # Wait, AuditLog requires a time_log_id. If linked_task is present, we could use its time_log.
        time_log_id = issuance.linked_task.time_log_id if (issuance.linked_task and hasattr(issuance.linked_task, 'time_log') and issuance.linked_task.time_log) else 0
        AuditLog.objects.create(
            company=issuance.org,
            time_log_id=time_log_id,
            employee=issuance.employee,
            actor=returned_by_user,
            action=AuditLog.Action.EDIT,
            reason=f"Damaged inventory returned: {issuance.item.name}",
            after_state={"condition": condition_on_return, "deduction_flagged": True}
        )

    issuance.save()

    # Increment available quantity
    item = issuance.item
    item.available_quantity += issuance.quantity
    item.save(update_fields=['available_quantity'])

    return issuance

def check_task_inventory(task):
    """
    Compares required items against available stock at the employee's assigned location
    and sets inventory_status accordingly.
    """
    if not task.assigned_to:
        return
    
    employee = task.assigned_to.employee_profile
    if not employee:
        return

    required_items = task.taskrequireditem_set.all()
    if not required_items.exists():
        task.inventory_status = Task.InventoryStatus.FULFILLED
        task.blocking_reason = ""
        task.save(update_fields=['inventory_status', 'blocking_reason'])
        return

    # Find the primary location for this employee, or the location specified by the task's job_site
    location = None
    if task.job_site and task.job_site.location:
        location = task.job_site.location
    else:
        # Get employee's primary location
        emp_loc = EmployeeLocation.objects.filter(employee=employee, is_primary=True).first()
        if emp_loc:
            location = emp_loc.location
        else:
            emp_loc = EmployeeLocation.objects.filter(employee=employee).first()
            if emp_loc:
                location = emp_loc.location

    if not location:
        # Assuming no specific location required if not defined, or we can't fulfill
        task.inventory_status = Task.InventoryStatus.MISSING
        task.blocking_reason = "No valid location found for the employee to check inventory."
        task.save(update_fields=['inventory_status', 'blocking_reason'])
        return

    missing = []
    partial = []
    
    for req in required_items:
        # Check stock of this inventory item at the specific location
        # The InventoryItem model has a `location` field.
        # But wait! Required item specifies an `InventoryItem`.
        # Is an `InventoryItem` specific to a location? Yes, it has `location` FK.
        # Wait, if `req.inventory_item.location` != `location`, it's not at the location.
        # Actually, maybe the task needs "Safety Helmet" in general, but `req.inventory_item` points to a specific record.
        # If `InventoryItem` is specific to a location, then checking if it is at the employee's location:
        
        item = req.inventory_item
        if item.location != location:
            missing.append(f"{item.name} is at {item.location.name if item.location else 'unknown'}, not at {location.name}")
        elif item.available_quantity < req.quantity_needed:
            if item.available_quantity > 0:
                partial.append(f"{item.name} (Need {req.quantity_needed}, Have {item.available_quantity})")
            else:
                missing.append(f"{item.name} (Out of stock at {location.name})")

    if missing:
        task.inventory_status = Task.InventoryStatus.MISSING
        task.blocking_reason = "; ".join(missing)
    elif partial:
        task.inventory_status = Task.InventoryStatus.PARTIAL
        task.blocking_reason = "; ".join(partial)
    else:
        task.inventory_status = Task.InventoryStatus.FULFILLED
        task.blocking_reason = ""
    
    task.save(update_fields=['inventory_status', 'blocking_reason'])
