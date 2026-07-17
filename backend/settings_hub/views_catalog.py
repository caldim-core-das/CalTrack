from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from accounts.permissions import IsAdminRole
from service_requests.models import CatalogCategory, CatalogService
from service_requests.serializers import CatalogCategorySerializer, CatalogServiceSerializer
import uuid
from django.core.files.storage import default_storage

class AdminCatalogCategoryListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        cats = CatalogCategory.objects.all().order_by('name')
        data = CatalogCategorySerializer(cats, many=True).data
        return Response({"success": True, "data": data})
        
    def post(self, request):
        serializer = CatalogCategorySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"success": True, "data": serializer.data})
        return Response({"success": False, "errors": serializer.errors}, status=400)

class AdminCatalogCategoryDetailView(APIView):
    permission_classes = [IsAdminRole]

    def put(self, request, pk):
        cat = get_object_or_404(CatalogCategory, pk=pk)
        serializer = CatalogCategorySerializer(cat, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"success": True, "data": serializer.data})
        return Response({"success": False, "errors": serializer.errors}, status=400)
        
    def delete(self, request, pk):
        cat = get_object_or_404(CatalogCategory, pk=pk)
        cat.delete()
        return Response({"success": True, "message": "Deleted successfully"})

class AdminCatalogServiceListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        cat_id = request.GET.get('category_id')
        qs = CatalogService.objects.all().order_by('name')
        if cat_id:
            qs = qs.filter(category_id=cat_id)
        data = CatalogServiceSerializer(qs, many=True).data
        return Response({"success": True, "data": data})

    def post(self, request):
        serializer = CatalogServiceSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"success": True, "data": serializer.data})
        return Response({"success": False, "errors": serializer.errors}, status=400)

class AdminCatalogServiceDetailView(APIView):
    permission_classes = [IsAdminRole]

    def put(self, request, pk):
        svc = get_object_or_404(CatalogService, pk=pk)
        serializer = CatalogServiceSerializer(svc, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"success": True, "data": serializer.data})
        return Response({"success": False, "errors": serializer.errors}, status=400)
        
    def delete(self, request, pk):
        svc = get_object_or_404(CatalogService, pk=pk)
        svc.delete()
        return Response({"success": True, "message": "Deleted successfully"})

class ImageUploadView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        file = request.FILES.get('image')
        if not file:
            return Response({"success": False, "message": "No image provided"}, status=400)
        
        ext = file.name.split('.')[-1]
        filename = f"catalog_{uuid.uuid4().hex}.{ext}"
        path = default_storage.save(f"catalog/{filename}", file)
        
        url = request.build_absolute_uri(default_storage.url(path))
        return Response({"success": True, "url": url})
