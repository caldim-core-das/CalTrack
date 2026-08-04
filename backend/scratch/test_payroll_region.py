import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')

import django
django.setup()

from django.test import RequestFactory
from django.contrib.auth import get_user_model
from companies.models import Company
from payroll.views import PayrollRegionSummaryView

User = get_user_model()
c = Company.objects.filter(company_name='caldim').order_by('-id').first()
print("Found Company:", c.id, c.company_name, c.schema_name, c.primary_country)

u = User.objects.filter(email__iexact='chiyaans787@gmail.com', role='admin').first()
factory = RequestFactory()
request = factory.get('/api/payroll/region-summary/')
request.user = u
request.company = c
request.tenant = c
view = PayrollRegionSummaryView.as_view()
response = view(request)
print("RESPONSE STATUS:", response.status_code)
print("RESPONSE DATA:", response.data)
