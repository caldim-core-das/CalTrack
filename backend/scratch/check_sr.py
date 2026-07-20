import os
import sys
import django
sys.path.append(os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()
from service_requests.models import ServiceRequest
print("\nAll Service Requests:")
for sr in ServiceRequest.objects.all():
    print(f"{sr.request_id} - {sr.status} - {sr.service_category} - {sr.company_id}")
