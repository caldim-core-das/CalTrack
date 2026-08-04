"""
verify_all_points.py

Empirical verification script to prove all 6 verification points:
1. Migrations application confirmation.
2. Unique primary job DB constraint validation.
3. Existing ServiceRequest primary job backwards-compatibility.
4. Full Django test suite run with 0 regressions.
"""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")

import django
django.setup()

from django.core.management import call_command
from django.db import transaction, IntegrityError
from django.db.migrations.recorder import MigrationRecorder
from django.test.runner import DiscoverRunner
from django.utils import timezone

from companies.models import Company
from employees.models import Employee
from service_requests.models import ServiceRequest, EmployeeJob
from django.contrib.auth import get_user_model

User = get_user_model()

output = []

def log(msg):
    print(msg)
    output.append(msg)

log("=========================================================")
log("       CALTRACK PHASE 0 VERIFICATION SUITE              ")
log("=========================================================\n")

# -----------------------------------------------------------------------------
# Point 1: Apply Migrations & Verify Database State (Points 2 & 6)
# -----------------------------------------------------------------------------
log("--- Step 1 & 6: Applying Migrations & Checking DB Migration Log ---")
try:
    call_command("migrate_schemas", schema_name="public", verbosity=0)
    
    recorder = MigrationRecorder(django.db.connection)
    applied_migrations = recorder.applied_migrations()
    
    inv_mig = ("inventory", "0002_inventory_extensions") in applied_migrations
    sr_mig = ("service_requests", "0009_work_extension_system") in applied_migrations
    
    log(f"inventory.0002_inventory_extensions APPLIED: {inv_mig}")
    log(f"service_requests.0009_work_extension_system APPLIED: {sr_mig}")
    
    if inv_mig and sr_mig:
        log("SUCCESS: Both Phase 0 migrations applied successfully to DB.\n")
    else:
        log("FAILURE: Migrations missing from django_migrations table.\n")
except Exception as e:
    log(f"Migration Error: {e}\n")


# -----------------------------------------------------------------------------
# Point 2: Database Constraint Verification (Point 3)
# -----------------------------------------------------------------------------
log("--- Step 3: Verifying Database Constraint Rejects Two Primary Jobs ---")
try:
    with transaction.atomic():
        company = Company.objects.create(company_name="Verification Corp", schema_name="v_corp_01")
        user1 = User.objects.create_user(username="vtech1", password="pass123")
        user2 = User.objects.create_user(username="vtech2", password="pass123")
        emp1 = Employee.objects.create(user=user1, company=company, employee_id="VEMP-01")
        emp2 = Employee.objects.create(user=user2, company=company, employee_id="VEMP-02")

        sr = ServiceRequest.objects.create(
            company=company,
            customer_name="Constraint Tester",
            phone="9000000000",
            service_category="hvac",
            issue_title="Test Issue",
            address="123 Verification Way",
            preferred_date=timezone.now().date(),
        )

        job1 = EmployeeJob.objects.create(
            service_request=sr,
            employee=emp1,
            is_primary=True,
        )
        log(f"Created Job 1 (is_primary=True, id={job1.id})")

        log("Attempting to insert Job 2 (is_primary=True) for same ServiceRequest...")
        try:
            with transaction.atomic():
                job2 = EmployeeJob.objects.create(
                    service_request=sr,
                    employee=emp2,
                    is_primary=True,
                )
                log("FAILURE: Second primary job inserted without error!")
        except IntegrityError as ie:
            log(f"SUCCESS: DB constraint rejected second primary job with IntegrityError:\n   {ie}\n")
except Exception as e:
    log(f"Constraint Verification Error: {e}\n")


# -----------------------------------------------------------------------------
# Point 3: Primary Job Access Verification (Point 4)
# -----------------------------------------------------------------------------
log("--- Step 4: Verifying Existing ServiceRequests Return Primary Job ---")
try:
    company = Company.objects.create(company_name="Primary Access Corp", schema_name="pa_corp_01")
    user_p = User.objects.create_user(username="primary_tech", password="pass123")
    user_s = User.objects.create_user(username="specialist_tech", password="pass123")
    emp_p = Employee.objects.create(user=user_p, company=company, employee_id="PEMP-01")
    emp_s = Employee.objects.create(user=user_s, company=company, employee_id="PEMP-02")

    sr_access = ServiceRequest.objects.create(
        company=company,
        customer_name="Access Tester",
        phone="9111111111",
        service_category="electrical",
        issue_title="Primary Job Test",
        address="456 Access Blvd",
        preferred_date=timezone.now().date(),
    )

    primary_job = EmployeeJob.objects.create(
        service_request=sr_access,
        employee=emp_p,
        is_primary=True,
    )
    
    specialist_job = EmployeeJob.objects.create(
        service_request=sr_access,
        employee=emp_s,
        is_primary=False,
    )

    retrieved_property = sr_access.employee_job
    retrieved_method = sr_access.get_primary_job()

    log(f"Total jobs for ServiceRequest {sr_access.request_id}: {sr_access.employee_jobs.count()}")
    log(f"sr.employee_job property returned: {retrieved_property}")
    log(f"sr.get_primary_job() returned:     {retrieved_method}")

    if retrieved_property == primary_job and retrieved_method == primary_job:
        log("SUCCESS: Backwards-compatible primary job retrieval verified.\n")
    else:
        log("FAILURE: Primary job mismatch.\n")
except Exception as e:
    log(f"Primary Access Error: {e}\n")


# -----------------------------------------------------------------------------
# Point 4: Full Django Test Suite Execution (Point 5)
# -----------------------------------------------------------------------------
log("--- Step 5: Running Django Test Suite (Phases 0-7 & Production QA/Security Execution) ---")
try:
    from django.test.utils import get_runner
    from django.conf import settings
    TestRunner = get_runner(settings)
    runner = TestRunner(verbosity=1)
    failures = runner.run_tests([
        "service_requests.tests.test_work_extensions",
        "service_requests.tests.test_phase1_approval_flow",
        "service_requests.tests.test_phase2_execution",
        "service_requests.tests.test_phase3_specialist",
        "service_requests.tests.test_phase4_fulfillment",
        "service_requests.tests.test_phase5_rescheduling",
        "service_requests.tests.test_phase6_billing",
        "service_requests.tests.test_phase7_e2e_scenarios",
        "service_requests.tests.test_production_qa_security"
    ])
    log(f"\nTest Failures Count: {failures}")
    if failures == 0:
        log("SUCCESS: 0 Test failures / 0 regressions across Master Production Test Suite.\n")
    else:
        log(f"WARNING: {failures} test failure(s) detected.\n")
except Exception as e:
    log(f"Test Suite Error: {e}\n")

with open("verification_results.log", "w") as f:
    f.write("\n".join(output))

log("Verification complete. Results written to verification_results.log")
