import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

try:
    user, created = User.objects.get_or_create(username='admin')
    user.set_password('admin123')
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.first_name = 'Admin'
    user.save()

    from employees.models import Employee
    employee, emp_created = Employee.objects.get_or_create(user=user)
    employee.employee_id = 'ADM-001'
    employee.job_title = 'System Administrator'
    employee.role = 'admin'
    employee.save()
    
    if created:
        print('SUCCESS: Created new admin user with password: admin123')
    else:
        print('SUCCESS: Reset existing admin user password to: admin123')
except Exception as e:
    print('ERROR:', e)
