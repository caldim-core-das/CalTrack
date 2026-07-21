# cleanup_users.py - Keep ONLY specified users, delete all others.
# Handles deep FK chains across all tenant schemas by deleting deepest children first.
import os, sys, django, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.db import connection

User = get_user_model()
user_table = User._meta.db_table  # "accounts_user"

KEEP_EMAILS = {
    "chiyaans787@gmail.com",
    "suryacaldim@gmail.com",
}

all_users  = list(User.objects.all().order_by("email"))
to_keep    = [u for u in all_users if u.email in KEEP_EMAILS]
to_delete  = [u for u in all_users if u.email not in KEEP_EMAILS]
delete_ids = [u.pk for u in to_delete]

print("\n" + "="*62)
print("  CLEANUP PREVIEW")
print("="*62)
print(f"\n  KEEPING ({len(to_keep)} users):")
for u in to_keep:
    print(f"    KEEP    {u.email:<40}  role={getattr(u,'role','N/A')}")
print(f"\n  DELETING ({len(to_delete)} users):")
for u in to_delete:
    e = u.email or "(no email)"
    print(f"    DELETE  {e:<40}  role={getattr(u,'role','N/A')}")
print("\n" + "="*62)

confirm = input(f"\n  Type YES to permanently delete {len(to_delete)} users: ").strip()
if confirm != "YES":
    print("\n  Aborted. No changes made.\n")
    sys.exit(0)

if not delete_ids:
    print("  Nothing to delete.")
    sys.exit(0)

placeholders = ", ".join(["%s"] * len(delete_ids))

def run(cur, sql, params=()):
    try:
        cur.execute(sql, params)
        if cur.rowcount:
            print(f"    OK ({cur.rowcount} rows): {sql[:100].strip()}")
    except Exception as e:
        pass  # silently skip missing tables

# ── Get all tenant schemas ───────────────────────────────────────────────────
with connection.cursor() as cur:
    cur.execute("""
        SELECT DISTINCT table_schema
        FROM information_schema.tables
        WHERE table_name = 'employees_employee'
        ORDER BY table_schema
    """)
    tenant_schemas = [row[0] for row in cur.fetchall()]

print(f"\n  Tenant schemas: {tenant_schemas}\n")

# ── Step 1: Delete deepest dependent tables first (all tenant schemas) ───────
print("  Step 1: Deleting deepest child rows in tenant schemas...")

# These are ordered from deepest FK chain → upward
# First: things that reference employees_employee
EMPLOYEE_CHILDREN = [
    "payroll_payrollrecord",
    "payroll_payslip",
    "employees_presencelog",
    "employees_bankdetail",
    "employees_emergencycontact",
    "employees_document",
    "employees_attendance",
    "leaves_leaveapplication",
    "leaves_leaveapproval",
    "time_tracking_timelog",
    "time_tracking_break",
    "time_tracking_employeelocation",
    "live_locations_employeelocation",
    "mileage_mileagelog",
    "scheduling_shiftassignment",
    "service_requests_servicerequest",
    "service_requests_employeejob",
    "service_requests_employeeperformance",
    "tasks_taskassignment",
    "notifications_notification",
    "compliance_compliancelog",
    "inventory_inventoryrequest",
    "quicktims_timelog",
    "reports_report",
]

with connection.cursor() as cur:
    for schema in tenant_schemas:
        # Get all employee IDs in this schema that belong to users being deleted
        try:
            cur.execute(
                f'SELECT id FROM "{schema}"."employees_employee" WHERE "user_id" IN ({placeholders})',
                delete_ids
            )
            emp_ids = [r[0] for r in cur.fetchall()]
        except Exception:
            emp_ids = []

        if emp_ids:
            emp_placeholders = ", ".join(["%s"] * len(emp_ids))
            for tbl in EMPLOYEE_CHILDREN:
                run(cur, f'DELETE FROM "{schema}"."{tbl}" WHERE "employee_id" IN ({emp_placeholders})', emp_ids)
                run(cur, f'DELETE FROM "{schema}"."{tbl}" WHERE "employee_id" IN ({emp_placeholders})', emp_ids)

        # Now delete rows directly referencing user_id
        USER_CHILD_TABLES = [
            "employees_employee",
            "time_tracking_timelog",
            "time_tracking_break",
            "notifications_notification",
            "tasks_task",
            "mileage_mileagelog",
            "leaves_leaveapplication",
            "leaves_leaveapproval",
            "scheduling_shift",
            "compliance_compliancelog",
            "reports_report",
            "inventory_inventoryrequest",
        ]
        for tbl in USER_CHILD_TABLES:
            run(cur, f'DELETE FROM "{schema}"."{tbl}" WHERE "user_id" IN ({placeholders})', delete_ids)
            run(cur, f'DELETE FROM "{schema}"."{tbl}" WHERE "created_by_id" IN ({placeholders})', delete_ids)
            run(cur, f'DELETE FROM "{schema}"."{tbl}" WHERE "approved_by_id" IN ({placeholders})', delete_ids)

        # teaminvite - NULL then delete
        run(cur, f'UPDATE "{schema}"."settings_hub_teaminvite" SET "invited_by_id" = NULL WHERE "invited_by_id" IN ({placeholders})', delete_ids)
        run(cur, f'DELETE FROM "{schema}"."settings_hub_teaminvite" WHERE "user_id" IN ({placeholders})', delete_ids)

# ── Step 2: Public schema cleanup ────────────────────────────────────────────
print("\n  Step 2: Public schema cleanup...")
with connection.cursor() as cur:
    PUBLIC = [
        "notifications_notification",
        "accounts_passwordresettoken",
        "accounts_emailverificationtoken",
        "accounts_userdevice",
        "trial_management_trialextensionrequest",
    ]
    for tbl in PUBLIC:
        run(cur, f'DELETE FROM "{tbl}" WHERE "user_id" IN ({placeholders})', delete_ids)
    run(cur, f'UPDATE "settings_hub_teaminvite" SET "invited_by_id" = NULL WHERE "invited_by_id" IN ({placeholders})', delete_ids)

# ── Step 3: Delete the users ──────────────────────────────────────────────────
print(f"\n  Step 3: Deleting {len(delete_ids)} users from {user_table}...")
with connection.cursor() as cur:
    try:
        cur.execute(f'DELETE FROM "{user_table}" WHERE "id" IN ({placeholders})', delete_ids)
        print(f"    SUCCESS: Deleted {cur.rowcount} users.")
    except Exception as e:
        print(f"    FAILED: {e}")
        print("\n  Hint: There may be more FK tables. Run this to find them:")
        print(f"    SELECT tc.constraint_name, tc.table_schema, tc.table_name, kcu.column_name")
        print(f"    FROM information_schema.referential_constraints rc")
        print(f"    JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name")
        print(f"    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name")
        print(f"    WHERE rc.unique_constraint_name IN (SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'accounts_user');")

remaining = User.objects.count()
print(f"\n  Done! Remaining users: {remaining}\n")
print("  FINAL USER LIST:")
for u in User.objects.all().order_by("email"):
    print(f"    {u.email:<44}  role={getattr(u,'role','N/A'):<12}  active={u.is_active}")
print()
