from django.urls import path, include
from rest_framework.routers import DefaultRouter
from inventory.views import (
    InventoryItemViewSet,
    InventoryIssuanceViewSet,
    MyInventoryViewSet,
    InventoryAlertViewSet,
    NearestStockViewSet
)

router = DefaultRouter()
router.register(r'items', InventoryItemViewSet, basename='inventory-items')
router.register(r'issuances', InventoryIssuanceViewSet, basename='inventory-issuances')
router.register(r'my-items', MyInventoryViewSet, basename='my-inventory')
router.register(r'alerts', InventoryAlertViewSet, basename='inventory-alerts')

urlpatterns = [
    path('', include(router.urls)),
    path('nearest-stock/<int:item_id>/', NearestStockViewSet.as_view({'get': 'list'}), name='nearest-stock'),
]
