from django.contrib import admin
from inventory.models import InventoryItem, InventoryIssuance, InventoryAlert, InventoryTransfer

@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'org', 'sku', 'category', 'location', 'total_quantity', 'available_quantity', 'reorder_threshold')
    list_filter = ('org', 'category', 'location')
    search_fields = ('name', 'sku')

@admin.register(InventoryIssuance)
class InventoryIssuanceAdmin(admin.ModelAdmin):
    list_display = ('item', 'org', 'employee', 'quantity', 'issued_at', 'expected_return_date', 'returned_at', 'condition_on_issue', 'condition_on_return')
    list_filter = ('org', 'condition_on_issue', 'condition_on_return', 'returned_at')
    search_fields = ('item__name', 'employee__employee_id')

@admin.register(InventoryAlert)
class InventoryAlertAdmin(admin.ModelAdmin):
    list_display = ('alert_type', 'org', 'item', 'employee', 'is_resolved', 'created_at')
    list_filter = ('org', 'alert_type', 'is_resolved')
    search_fields = ('item__name', 'message')

@admin.register(InventoryTransfer)
class InventoryTransferAdmin(admin.ModelAdmin):
    list_display = ('item', 'from_location', 'to_location', 'quantity', 'status', 'requested_at', 'delivered_at')
    list_filter = ('status', 'from_location', 'to_location')
    search_fields = ('item__name',)
