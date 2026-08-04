import django, os, sys
sys.path.insert(0, '.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from companies.models import Company
from django.db import connection
from django.contrib.auth import get_user_model
from employees.models import Employee
from employees.serializers import EmployeeSerializer

User = get_user_model()
c = Company.objects.get(id=11)
connection.set_tenant(c)

print(f"Company 11 schema: {c.schema_name}")
admin_user = User.objects.filter(company=c, role="admin").first()
print(f"Admin User: {admin_user.username if admin_user else None}")

emps = Employee.objects.filter(company=c, is_active=True).select_related("user")
print(f"Employee count: {emps.count()}")
for e in emps:
    u = e.user
    role_in_u = u.role if u else None
    print(f"  ID:{e.id} | emp_id:{e.employee_id} | title:{e.title} | user_id:{u.id if u else None} | username:{u.username if u else None} | user_role:{role_in_u}")

from rest_framework.test import APIRequestFactory
factory = APIRequestFactory()
request = factory.get('/api/tasks/admin/available-employees/')
request.user = admin_user
request.company = c

ser = EmployeeSerializer(emps, many=True, context={'request': request})
import json
print("\nSerialized available-employees output:")
for item in ser.data:
    print(f"  item id:{item.get('id')} | user:{item.get('user')} | role:{item.get('role')} | title:{item.get('title')}")
