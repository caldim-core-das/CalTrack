import os
import django
from dotenv import load_dotenv

# Load .env explicitly
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'), override=True)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from django.contrib.auth import get_user_model
from companies.models import Company

User = get_user_model()

try:
    company = Company.objects.exclude(schema_name='public').first()
    
    user, created = User.objects.get_or_create(username='admin')
    user.set_password('admin123')
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.first_name = 'Admin'
    user.role = 'admin'
    if company:
        user.company = company
    user.save()

    if company:
        from django_tenants.utils import schema_context
        from employees.models import Employee
        with schema_context(company.schema_name):
            employee, emp_created = Employee.objects.get_or_create(
                user=user,
                defaults={
                    'employee_id': 'ADM-001',
                    'title': 'System Administrator',
                    'company': company,
                }
            )
            if not emp_created:
                employee.employee_id = 'ADM-001'
                employee.title = 'System Administrator'
                employee.company = company
                employee.save()
        print('SUCCESS: Associated admin user with company:', company.company_name)
    else:
        print('WARNING: No company found in the database. Admin user created/updated but employee profile could not be created.')
    
    if created:
        print('SUCCESS: Created new admin user with password: admin123')
    else:
        print('SUCCESS: Reset existing admin user password to: admin123')
except Exception as e:
    print('ERROR:', e)

