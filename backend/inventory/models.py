from django.db import models
from django.conf import settings
from companies.models import Company
from time_tracking.models import Location
from employees.models import Employee
from scheduling.models import Shift
from tasks.models import Task

class InventoryItem(models.Model):
    class Category(models.TextChoices):
        EQUIPMENT = 'equipment', 'Equipment'
        CONSUMABLE = 'consumable', 'Consumable'
        UNIFORM = 'uniform', 'Uniform'
        VEHICLE = 'vehicle', 'Vehicle'
        PPE = 'ppe', 'PPE'
        TOOL = 'tool', 'Tool'

    org = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='inventory_items')
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=50, choices=Category.choices)
    sku = models.CharField(max_length=100, blank=True)
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_stock')
    total_quantity = models.PositiveIntegerField(default=0)
    available_quantity = models.PositiveIntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    reorder_threshold = models.PositiveIntegerField(default=0)
    is_returnable = models.BooleanField(default=True)
    requires_photo_on_issue = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.sku})"

class InventoryIssuance(models.Model):
    class Condition(models.TextChoices):
        NEW = 'new', 'New'
        GOOD = 'good', 'Good'
        FAIR = 'fair', 'Fair'
        DAMAGED = 'damaged', 'Damaged'

    org = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='inventory_issuances')
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='issuances')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='issued_items')
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='issued_inventory')
    quantity = models.PositiveIntegerField(default=1)
    issued_at = models.DateTimeField(auto_now_add=True)
    expected_return_date = models.DateField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    condition_on_issue = models.CharField(max_length=20, choices=Condition.choices, default=Condition.GOOD)
    condition_on_return = models.CharField(max_length=20, choices=Condition.choices, null=True, blank=True)
    linked_shift = models.ForeignKey(Shift, on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_issuances')
    linked_task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_issuances')
    notes = models.TextField(blank=True)
    photo_proof = models.ImageField(upload_to='inventory_photos/', null=True, blank=True)
    deduction_flagged = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.quantity}x {self.item.name} to {self.employee}"

class InventoryAlert(models.Model):
    class AlertType(models.TextChoices):
        LOW_STOCK = 'low_stock', 'Low Stock'
        OVERDUE_RETURN = 'overdue_return', 'Overdue Return'
        DAMAGE_REPORTED = 'damage_reported', 'Damage Reported'

    org = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='inventory_alerts')
    alert_type = models.CharField(max_length=50, choices=AlertType.choices)
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='alerts')
    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_alerts')
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.alert_type} for {self.item.name}"

class InventoryTransfer(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_TRANSIT = 'in_transit', 'In Transit'
        DELIVERED = 'delivered', 'Delivered'

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='transfers')
    from_location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='outgoing_transfers')
    to_location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='incoming_transfers')
    quantity = models.PositiveIntegerField(default=1)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='requested_transfers')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    linked_task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='inventory_transfers', null=True, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Transfer {self.quantity}x {self.item.name} to {self.to_location.name}"
