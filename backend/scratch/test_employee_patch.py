import dotenv
dotenv.load_dotenv('c:/Users/user/Caltrackk/Caltrack/backend/.env')
import os, sys, django

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from django.db import connection
cursor = connection.cursor()
cursor.execute("SELECT table_schema FROM information_schema.tables WHERE table_name = 'employees_employee'")
schemas = [r[0] for r in cursor.fetchall()]
print('Schemas with employees_employee:', schemas)

from employees.models import Employee
from employees.serializers import EmployeeSerializer
from django.contrib.auth import get_user_model
User = get_user_model()
from django_tenants.utils import schema_context

for schema in schemas:
    with schema_context(schema):
        for emp in Employee.objects.all():
            print(f"\n--- Tenant: {schema} | Employee ID: {emp.id} | Employee_ID: {emp.employee_id} ---")
            print('User:', emp.user.username if emp.user else None, emp.user.email if emp.user else None)
            print('Title:', emp.title, 'Hourly Rate:', emp.hourly_rate, 'Country:', emp.country, 'State:', emp.state)
            print('Exempt:', emp.exempt_status, 'Weekly Salary:', emp.weekly_salary)
            print('Invited by:', emp.invited_by)

            # Construct EXACT payload as EmployeesPage.jsx does:
            # data object passed to saveEdit:
            # firstName, lastName, email, title, hourlyRate, country, state, exemptStatus, weeklySalary, ukTaxCode, ukNiCategory, rolledUpHolidayPay, isActive, serviceRoles
            payload = {
                'username': emp.user.username if emp.user else '',
                'email': emp.user.email if emp.user else '',
                'first_name': emp.user.first_name if emp.user else '',
                'last_name': emp.user.last_name if emp.user else '',
                'title': emp.title or '',
                'hourly_rate': float(emp.hourly_rate or 0),
                'country': emp.country or None,
                'state': emp.state if emp.country in ['US', 'IN'] else None,
                'exempt_status': emp.exempt_status or 'non_exempt',
                'weekly_salary': float(emp.weekly_salary) if (emp.country == 'US' and emp.weekly_salary is not None) else None,
                'uk_tax_code': emp.uk_tax_code if emp.country == 'UK' else None,
                'uk_ni_category': emp.uk_ni_category if emp.country == 'UK' else None,
                'rolled_up_holiday_pay': bool(emp.rolled_up_holiday_pay) if emp.country == 'UK' else False,
                'department': emp.department or None,
                'currency': emp.currency or None,
                'payroll_group': emp.payroll_group_id if hasattr(emp, 'payroll_group_id') else None,
                'tax_category': emp.tax_category or None,
                'is_active': bool(emp.is_active),
                'service_roles': emp.service_roles or [],
            }

            admin = User.objects.filter(role=User.Role.ADMIN).first() or User.objects.first()
            from rest_framework.test import APIRequestFactory
            factory = APIRequestFactory()
            request = factory.patch(f'/api/employees/{emp.id}/', payload, format='json')
            request.user = admin

            serializer = EmployeeSerializer(emp, data=payload, partial=True, context={'request': request})
            if not serializer.is_valid():
                print('>>> VALIDATION ERROR ON PATCH:', serializer.errors)
            else:
                print('>>> VALIDATION SUCCESS ON PATCH')
