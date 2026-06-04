import math
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAdminRole
from inventory.models import InventoryItem, InventoryIssuance, InventoryAlert, InventoryTransfer
from inventory.serializers import (
    InventoryItemSerializer, InventoryIssuanceSerializer,
    InventoryAlertSerializer, InventoryTransferSerializer
)
from inventory.services import issue_inventory, return_inventory

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) * math.sin(dlat / 2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) * math.sin(dlon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class StandardResponseMixin:
    def success_response(self, data=None, message="", status_code=status.HTTP_200_OK):
        return Response({
            "success": True,
            "data": data or {},
            "message": message
        }, status=status_code)

    def error_response(self, message, status_code=status.HTTP_400_BAD_REQUEST):
        return Response({
            "success": False,
            "message": message
        }, status=status_code)

class InventoryItemViewSet(StandardResponseMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = InventoryItemSerializer

    def get_queryset(self):
        return InventoryItem.objects.filter(org=self.request.company)

    def perform_create(self, serializer):
        serializer.save(org=self.request.company)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return self.success_response(data=serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            self.perform_create(serializer)
            return self.success_response(data=serializer.data, message="Item created successfully", status_code=status.HTTP_201_CREATED)
        return self.error_response(message=str(serializer.errors))

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            self.perform_update(serializer)
            return self.success_response(data=serializer.data, message="Item updated successfully")
        return self.error_response(message=str(serializer.errors))

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return self.success_response(message="Item deleted successfully")


class InventoryIssuanceViewSet(StandardResponseMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = InventoryIssuanceSerializer

    def get_queryset(self):
        return InventoryIssuance.objects.filter(org=self.request.company)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return self.success_response(data=serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return self.error_response(message=str(serializer.errors))
        
        try:
            issuance = issue_inventory(
                item=serializer.validated_data['item'],
                employee=serializer.validated_data['employee'],
                issued_by=request.user,
                quantity=serializer.validated_data.get('quantity', 1),
                expected_return_date=serializer.validated_data.get('expected_return_date'),
                linked_shift=serializer.validated_data.get('linked_shift'),
                linked_task=serializer.validated_data.get('linked_task'),
                notes=serializer.validated_data.get('notes', ''),
                condition_on_issue=serializer.validated_data.get('condition_on_issue', InventoryIssuance.Condition.GOOD),
                photo_proof=serializer.validated_data.get('photo_proof')
            )
            return self.success_response(
                data=self.get_serializer(issuance).data,
                message="Item issued successfully",
                status_code=status.HTTP_201_CREATED
            )
        except Exception as e:
            return self.error_response(message=str(e))

    @action(detail=True, methods=['patch'])
    def return_item(self, request, pk=None):
        issuance = self.get_object()
        condition_on_return = request.data.get('condition_on_return', InventoryIssuance.Condition.GOOD)
        notes = request.data.get('notes', '')
        
        try:
            returned_issuance = return_inventory(issuance, request.user, condition_on_return, notes)
            return self.success_response(
                data=self.get_serializer(returned_issuance).data,
                message="Item returned successfully"
            )
        except Exception as e:
            return self.error_response(message=str(e))


class MyInventoryViewSet(StandardResponseMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InventoryIssuanceSerializer

    def get_queryset(self):
        if not hasattr(self.request.user, 'employee_profile'):
            return InventoryIssuance.objects.none()
        return InventoryIssuance.objects.filter(
            org=self.request.company,
            employee=self.request.user.employee_profile,
            returned_at__isnull=True
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return self.success_response(data=serializer.data)


class InventoryAlertViewSet(StandardResponseMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = InventoryAlertSerializer

    def get_queryset(self):
        return InventoryAlert.objects.filter(org=self.request.company, is_resolved=False)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return self.success_response(data=serializer.data)

    @action(detail=True, methods=['patch'])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.is_resolved = True
        alert.save(update_fields=['is_resolved'])
        return self.success_response(message="Alert resolved successfully")


class NearestStockViewSet(StandardResponseMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request, item_id=None):
        try:
            item = InventoryItem.objects.get(id=item_id, org=request.company)
        except InventoryItem.DoesNotExist:
            return self.error_response(message="Item not found", status_code=status.HTTP_404_NOT_FOUND)

        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')

        if not lat or not lng:
            return self.error_response(message="lat and lng are required")
        
        try:
            lat = float(lat)
            lng = float(lng)
        except ValueError:
            return self.error_response(message="Invalid lat/lng")

        # Find items with same SKU or Name that have available stock
        similar_items = InventoryItem.objects.filter(
            org=request.company,
            available_quantity__gt=0
        ).exclude(location__isnull=True)

        if item.sku:
            similar_items = similar_items.filter(sku=item.sku)
        else:
            similar_items = similar_items.filter(name=item.name)

        locations_with_stock = []
        for sim_item in similar_items:
            loc = sim_item.location
            dist = haversine(lat, lng, loc.lat, loc.lng)
            locations_with_stock.append({
                'location_id': loc.id,
                'location_name': loc.name,
                'lat': float(loc.lat) if loc.lat else None,
                'lng': float(loc.lng) if loc.lng else None,
                'distance_km': round(dist, 2),
                'available_quantity': sim_item.available_quantity,
                'item_id': sim_item.id
            })
        
        locations_with_stock.sort(key=lambda x: x['distance_km'])

        return self.success_response(data=locations_with_stock)
