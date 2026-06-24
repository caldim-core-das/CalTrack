import os
import django
import sys
from contextlib import contextmanager

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.db import connection
from django.contrib.auth import get_user_model
from companies.models import Company
from employees.models import Employee

@contextmanager
def safe_schema_context(schema_name):
    if hasattr(connection, "tenant"):
        from django_tenants.utils import schema_context
        with schema_context(schema_name):
            yield
    else:
        yield

def run_verification():
    print("=== STARTING EMPLOYEE VISIBILITY RESTRICTION TESTS ===")
    User = get_user_model()
    company = Company.objects.exclude(schema_name="public").first()
    if not company:
        print("[FAIL] No tenant company found.")
        return

    with safe_schema_context(company.schema_name):
        # Clear previous test users and employees
        User.objects.filter(username__in=["admin_a", "admin_b", "emp_a", "emp_b", "admin_super"]).delete()

        # 1. Create two admins (Admin A, Admin B)
        admin_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@test.com",
            password="password123",
            role=User.Role.ADMIN,
            company=company
        )
        admin_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@test.com",
            password="password123",
            role=User.Role.ADMIN,
            company=company
        )

        # 2. Create two employees
        user_emp_a = User.objects.create_user(
            username="emp_a",
            email="emp_a@test.com",
            password="password123",
            role=User.Role.EMPLOYEE,
            company=company
        )
        user_emp_b = User.objects.create_user(
            username="emp_b",
            email="emp_b@test.com",
            password="password123",
            role=User.Role.EMPLOYEE,
            company=company
        )

        # Create Employee A and associate with Admin A
        emp_a = Employee.objects.create(
            user=user_emp_a,
            company=company,
            employee_id="EMPA-01",
            invited_by=admin_a,
            is_active=True
        )
        # Create Employee B and associate with Admin B
        emp_b = Employee.objects.create(
            user=user_emp_b,
            company=company,
            employee_id="EMPB-01",
            invited_by=admin_b,
            is_active=True
        )

        print("[OK] Test users and employees created successfully.")

        # Test 3: Verify EmployeeViewSet.get_queryset equivalent for Admin A
        # Let's mock a request object with user = admin_a
        class MockRequest:
            def __init__(self, user, company):
                self.user = user
                self.company = company

        from employees.views import EmployeeViewSet
        view = EmployeeViewSet()
        
        # Test Admin A
        view.request = MockRequest(admin_a, company)
        qs_a = view.get_queryset()
        print(f"Admin A sees {qs_a.count()} employees: {[e.user.username for e in qs_a]}")
        username_list_a = [e.user.username for e in qs_a]
        assert "emp_a" in username_list_a, "Admin A should see Employee A"
        assert "emp_b" not in username_list_a, "Admin A should NOT see Employee B"

        # Test Admin B
        view.request = MockRequest(admin_b, company)
        qs_b = view.get_queryset()
        print(f"Admin B sees {qs_b.count()} employees: {[e.user.username for e in qs_b]}")
        username_list_b = [e.user.username for e in qs_b]
        assert "emp_b" in username_list_b, "Admin B should see Employee B"
        assert "emp_a" not in username_list_b, "Admin B should NOT see Employee A"

        # Test Superuser (who is also an admin but has is_superuser = True)
        superuser = User.objects.create_superuser(
            username="admin_super",
            email="super@test.com",
            password="password123",
            company=company
        )
        view.request = MockRequest(superuser, company)
        qs_super = view.get_queryset()
        print(f"Superuser sees {qs_super.count()} employees: {[e.user.username for e in qs_super]}")
        assert qs_super.count() >= 2, "Superuser should see both employees"

        # Test 4: Verify AdminAvailableEmployeesView queryset filtering
        from tasks.views.task_views import AdminAvailableEmployeesView
        from rest_framework.test import APIRequestFactory
        from rest_framework.test import force_authenticate

        factory = APIRequestFactory()
        task_view = AdminAvailableEmployeesView.as_view()

        # Admin A Request
        req_a = factory.get("/api/tasks/admin/available-employees/")
        force_authenticate(req_a, user=admin_a)
        req_a.company = company
        res_a = task_view(req_a)
        print("Admin A available employees API returned:", len(res_a.data))
        usernames_a = [item['user']['username'] for item in res_a.data]
        assert "emp_a" in usernames_a, "Admin A should see emp_a"
        assert "emp_b" not in usernames_a, "Admin A should NOT see emp_b"

        # Admin B Request
        req_b = factory.get("/api/tasks/admin/available-employees/")
        force_authenticate(req_b, user=admin_b)
        req_b.company = company
        res_b = task_view(req_b)
        print("Admin B available employees API returned:", len(res_b.data))
        usernames_b = [item['user']['username'] for item in res_b.data]
        assert "emp_b" in usernames_b, "Admin B should see emp_b"
        assert "emp_a" not in usernames_b, "Admin B should NOT see emp_a"

        # Test 5: Verify Live Location Views filtering (CurrentLocationsListView, SOSView, GeofenceBreachListView)
        from live_locations.views import CurrentLocationsListView, SOSView, GeofenceBreachListView
        from live_locations.models import EmployeeLocation, SOSAlert, GeofenceBreach
        from time_tracking.models import TimeLog
        from django.utils import timezone
        from decimal import Decimal

        log_a = TimeLog.objects.create(employee=emp_a, work_date=timezone.localdate(), clock_in=timezone.now())
        log_b = TimeLog.objects.create(employee=emp_b, work_date=timezone.localdate(), clock_in=timezone.now())

        loc_a = EmployeeLocation.objects.create(employee=emp_a, time_log=log_a, lat=Decimal("12.345"), lng=Decimal("76.543"))
        loc_b = EmployeeLocation.objects.create(employee=emp_b, time_log=log_b, lat=Decimal("12.345"), lng=Decimal("76.543"))

        sos_a = SOSAlert.objects.create(employee=emp_a, time_log=log_a, lat=Decimal("12.345"), lng=Decimal("76.543"), status="active")
        sos_b = SOSAlert.objects.create(employee=emp_b, time_log=log_b, lat=Decimal("12.345"), lng=Decimal("76.543"), status="active")

        breach_a = GeofenceBreach.objects.create(employee=emp_a, time_log=log_a, lat=Decimal("12.345"), lng=Decimal("76.543"), distance_meters=500, geofence_radius=200)
        breach_b = GeofenceBreach.objects.create(employee=emp_b, time_log=log_b, lat=Decimal("12.345"), lng=Decimal("76.543"), distance_meters=500, geofence_radius=200)

        # Test CurrentLocationsListView
        curr_loc_view = CurrentLocationsListView.as_view()
        
        req_a_loc = factory.get("/api/live-locations/current/")
        force_authenticate(req_a_loc, user=admin_a)
        req_a_loc.company = company
        res_a_loc = curr_loc_view(req_a_loc)
        print("Admin A current locations returned:", len(res_a_loc.data))
        emp_ids_a = [str(item.get('employee')) for item in res_a_loc.data]
        assert str(emp_a.id) in emp_ids_a, "Admin A should see emp_a location"
        assert str(emp_b.id) not in emp_ids_a, "Admin A should NOT see emp_b location"

        req_b_loc = factory.get("/api/live-locations/current/")
        force_authenticate(req_b_loc, user=admin_b)
        req_b_loc.company = company
        res_b_loc = curr_loc_view(req_b_loc)
        print("Admin B current locations returned:", len(res_b_loc.data))
        emp_ids_b = [str(item.get('employee')) for item in res_b_loc.data]
        assert str(emp_b.id) in emp_ids_b, "Admin B should see emp_b location"
        assert str(emp_a.id) not in emp_ids_b, "Admin B should NOT see emp_a location"

        # Test SOSView
        sos_view = SOSView.as_view()
        
        req_a_sos = factory.get("/api/live-locations/sos/")
        force_authenticate(req_a_sos, user=admin_a)
        req_a_sos.company = company
        res_a_sos = sos_view(req_a_sos)
        print("Admin A SOS alerts returned:", len(res_a_sos.data))
        sos_ids_a = [item['id'] for item in res_a_sos.data]
        assert str(sos_a.id) in sos_ids_a, "Admin A should see sos_a"
        assert str(sos_b.id) not in sos_ids_a, "Admin A should NOT see sos_b"

        req_b_sos = factory.get("/api/live-locations/sos/")
        force_authenticate(req_b_sos, user=admin_b)
        req_b_sos.company = company
        res_b_sos = sos_view(req_b_sos)
        print("Admin B SOS alerts returned:", len(res_b_sos.data))
        sos_ids_b = [item['id'] for item in res_b_sos.data]
        assert str(sos_b.id) in sos_ids_b, "Admin B should see sos_b"
        assert str(sos_a.id) not in sos_ids_b, "Admin B should NOT see sos_a"

        # Test GeofenceBreachListView
        breach_view = GeofenceBreachListView.as_view()

        req_a_br = factory.get("/api/live-locations/breaches/")
        force_authenticate(req_a_br, user=admin_a)
        req_a_br.company = company
        res_a_br = breach_view(req_a_br)
        print("Admin A breaches returned:", len(res_a_br.data))
        breach_ids_a = [item['id'] for item in res_a_br.data]
        assert str(breach_a.id) in breach_ids_a, "Admin A should see breach_a"
        assert str(breach_b.id) not in breach_ids_a, "Admin A should NOT see breach_b"

        req_b_br = factory.get("/api/live-locations/breaches/")
        force_authenticate(req_b_br, user=admin_b)
        req_b_br.company = company
        res_b_br = breach_view(req_b_br)
        print("Admin B breaches returned:", len(res_b_br.data))
        breach_ids_b = [item['id'] for item in res_b_br.data]
        assert str(breach_b.id) in breach_ids_b, "Admin B should see breach_b"
        assert str(breach_a.id) not in breach_ids_b, "Admin B should NOT see breach_a"

        # Clean up testing instances
        log_a.delete()
        log_b.delete()

    print("\n=== ALL EMPLOYEE VISIBILITY RESTRICTION TESTS PASSED ===")

if __name__ == "__main__":
    run_verification()
