import os
import sys
import django
sys.path.append(os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()
from companies.models import Company
print("Companies:")
for c in Company.objects.all():
    print(f"ID: {c.id}, Name: {c.schema_name}")

from django.db import connection
print("\nService Requests per schema:")
for c in Company.objects.exclude(schema_name='public'):
    connection.set_tenant(c)
    from service_requests.models import ServiceRequest
    count = ServiceRequest.objects.count()
    print(f"{c.schema_name} has {count} requests.")
    for sr in ServiceRequest.objects.order_by("-id")[:5]:
        print(f"  {sr.request_id} - {sr.status}")
