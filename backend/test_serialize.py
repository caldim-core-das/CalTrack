import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from service_requests.models import Complaint
from service_requests.views import _serialize_complaint
from django_tenants.utils import schema_context

with schema_context('public'): # or the tenant they use, 'caldim-core-das'
    try:
        c = Complaint.objects.first()
        if c:
            print("Found complaint", c.pk)
            print(_serialize_complaint(c))
        else:
            print("No complaints found")
    except Exception as e:
        import traceback
        traceback.print_exc()
