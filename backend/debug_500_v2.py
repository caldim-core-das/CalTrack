import os
import django
from django.test import RequestFactory
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from accounts.models import User
from companies.models import Company
from time_tracking.views import TimesheetView, CurrentSessionView

def test_view(view_class, path):
    print(f"\nTesting {path}...")
    try:
        user = User.objects.get(username='admin')
        rf = RequestFactory()
        raw_request = rf.get(path)
        raw_request.user = user
        
        company = Company.objects.get(schema_name='caldim_kal')
        raw_request.company = company
        raw_request.tenant = company
        
        view = view_class.as_view(permission_classes=[])
        response = view(raw_request)
        print(f"Status: {response.status_code}")
        if response.status_code == 500:
            print(response.content.decode('utf-8'))
        elif response.status_code >= 400:
            print(f"Data: {response.data}")
    except Exception:
        traceback.print_exc()

test_view(TimesheetView, '/api/time/timesheets/')
test_view(CurrentSessionView, '/api/time/current-session/')
