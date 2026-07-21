import os
import sys
import django

# Set up path
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

# Set up Django
os.environ["DJANGO_SETTINGS_MODULE"] = "quicktims.settings"
os.environ["DJANGO_SECRET_KEY"] = "dev-only-secret-key-change-me"
os.environ["DB_NAME"] = "caltrack"
os.environ["DB_USER"] = "caltrack_user"
os.environ["DB_PASSWORD"] = "caltrack_pass"
os.environ["DB_HOST"] = "localhost"

django.setup()

from django.contrib.auth import get_user_model
from employees.models import Employee
from employees.serializers import EmployeeSerializer
from django_tenants.utils import tenant_context
from companies.models import Company

company = Company.objects.get(schema_name='caldim_2')
with tenant_context(company):
    emp = Employee.objects.get(id=3)
    # Set hourly_rate to a different value to trigger the rate-change validation check
    payload = {
        'username': 'vijay',
        'email': 'vijay@caldim.com',
        'first_name': 'vijay',
        'last_name': 's',
        'title': 'AC Technician',
        'hourly_rate': 25.00,  # Changed from 20.00 to trigger validation
        'country': 'IN',
        'state': 'MH',
        'is_active': True,
        'service_roles': []
    }
    from rest_framework.test import APIRequestFactory
    factory = APIRequestFactory()
    request = factory.patch('/api/employees/3/')
    request.user = get_user_model().objects.get(id=101)  # Using duplicate user ID 101 to check if email match works
    request.company = emp.company
    
    serializer = EmployeeSerializer(emp, data=payload, partial=True, context={'request': request})
    if serializer.is_valid():
        print('SUCCESS: Serializer is valid')
    else:
        print('FAILED: Validation errors:', serializer.errors)
