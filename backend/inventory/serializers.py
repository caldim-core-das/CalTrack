from rest_framework import serializers
from inventory.models import InventoryItem, InventoryIssuance, InventoryAlert, InventoryTransfer

class InventoryItemSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)
    
    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'category', 'sku', 'location', 'location_name',
            'total_quantity', 'available_quantity', 'unit_cost',
            'reorder_threshold', 'is_returnable', 'requires_photo_on_issue',
            'created_at'
        ]
        read_only_fields = ['available_quantity', 'created_at']

    def create(self, validated_data):
        validated_data['available_quantity'] = validated_data.get('total_quantity', 0)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'total_quantity' in validated_data:
            diff = validated_data['total_quantity'] - instance.total_quantity
            instance.available_quantity += diff
        return super().update(instance, validated_data)

class InventoryIssuanceSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    issued_by_name = serializers.CharField(source='issued_by.get_full_name', read_only=True)

    class Meta:
        model = InventoryIssuance
        fields = [
            'id', 'item', 'item_name', 'employee', 'employee_name', 'issued_by',
            'issued_by_name', 'quantity', 'issued_at', 'expected_return_date',
            'returned_at', 'condition_on_issue', 'condition_on_return',
            'linked_shift', 'linked_task', 'notes', 'photo_proof', 'deduction_flagged'
        ]
        read_only_fields = ['issued_at', 'returned_at', 'deduction_flagged', 'issued_by']

class InventoryAlertSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)

    class Meta:
        model = InventoryAlert
        fields = [
            'id', 'alert_type', 'item', 'item_name', 'employee', 'employee_name',
            'message', 'is_resolved', 'created_at'
        ]
        read_only_fields = ['created_at']

class InventoryTransferSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    from_location_name = serializers.CharField(source='from_location.name', read_only=True)
    to_location_name = serializers.CharField(source='to_location.name', read_only=True)

    class Meta:
        model = InventoryTransfer
        fields = [
            'id', 'item', 'item_name', 'from_location', 'from_location_name',
            'to_location', 'to_location_name', 'quantity', 'requested_by',
            'status', 'linked_task', 'requested_at', 'delivered_at'
        ]
        read_only_fields = ['requested_at', 'delivered_at', 'requested_by']
