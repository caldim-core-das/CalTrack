"""
ULTIMATE cleanup - no prompts, runs straight through.
Queries all FK refs to accounts_user dynamically, NULLs nullable columns,
deletes non-nullable rows, then deletes users.

KEEP: chiyaans787@gmail.com (admin) + suryacaldim@gmail.com (employee)
DELETE: everything else
"""
import psycopg2, os, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
env = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

conn = psycopg2.connect(
    host=env.get('DB_HOST','localhost'), port=env.get('DB_PORT','5432'),
    dbname=env.get('DB_NAME','caltrack'), user=env.get('DB_USER','postgres'),
    password=env.get('DB_PASSWORD',''),
)
conn.autocommit = True
cur = conn.cursor()

KEEP_EMAILS = {'chiyaans787@gmail.com', 'suryacaldim@gmail.com'}
cur.execute('SELECT id, email FROM "accounts_user" ORDER BY email')
all_users = cur.fetchall()
delete_ids = [u[0] for u in all_users if u[1] not in KEEP_EMAILS]

if not delete_ids:
    print("Nothing to delete.")
    sys.exit(0)

ph = ", ".join(["%s"] * len(delete_ids))

print(f"Deleting {len(delete_ids)} users: {delete_ids}")
print("Keep:", [u[1] for u in all_users if u[1] in KEEP_EMAILS])

# ── Step 1: Get ALL FK refs to accounts_user with nullability ─────────────────
cur.execute("""
    SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        col.is_nullable
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.columns col
        ON col.table_schema = tc.table_schema
        AND col.table_name = tc.table_name
        AND col.column_name = kcu.column_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'accounts_user'
    ORDER BY tc.table_schema, tc.table_name, kcu.column_name
""")
fk_refs = cur.fetchall()
print(f"Found {len(fk_refs)} FK references.\n")

def run(sql, params=()):
    try:
        cur.execute(sql, params)
        if cur.rowcount:
            print(f"  {cur.rowcount}: {sql[:95]}")
    except Exception as e:
        err = str(e)
        # Only print non-trivial errors
        if "does not exist" not in err:
            print(f"  ERR: {err[:100]}")

# ── Step 2: Process each FK reference ────────────────────────────────────────
print("--- Clearing FK references ---")
for schema, table, col, nullable in fk_refs:
    if schema == 'public' and table == 'accounts_user':
        continue  # skip the user table itself
    if nullable == 'YES':
        run(f'UPDATE "{schema}"."{table}" SET "{col}" = NULL WHERE "{col}" IN ({ph})', delete_ids)
    else:
        run(f'DELETE FROM "{schema}"."{table}" WHERE "{col}" IN ({ph})', delete_ids)

# ── Step 3: Clean up remaining employee FK children ───────────────────────────
SCHEMAS = ['caldim', 'caldim_2', 'caldim_engg', 'dd', 'ddd', 'demo', 'kalyani_co', 'rohit', 'test_co_123']

print("\n--- Cleaning employee children ---")
for s in SCHEMAS:
    try:
        cur.execute(f'SELECT id FROM "{s}"."employees_employee" WHERE "user_id" IN ({ph})', delete_ids)
        emp_ids = [r[0] for r in cur.fetchall()]
    except Exception:
        emp_ids = []
    if not emp_ids:
        continue

    ep = ", ".join(["%s"] * len(emp_ids))
    print(f"  [{s}] employee ids: {emp_ids}")

    for tbl in [
        "time_tracking_timelog", "employees_presencelog",
        "compliance_auditlog", "compliance_breakattestation", "compliance_holidayaccrual",
        "compliance_overtimealert", "compliance_righttowork", "compliance_wtroptout",
        "payroll_payrollrecord", "payroll_payrollgeneration",
        "live_locations_employeelocation", "live_locations_geofencebreach", "live_locations_sosalert",
        "mileage_mileagetrip", "mileage_mileageytdtracker",
        "service_requests_servicerequest", "service_requests_employeejob",
        "service_requests_employeeperformance", "service_requests_jobcompletionproof",
        "leaves_leaverequest", "inventory_inventoryissuance", "inventory_inventoryalert",
        "scheduling_shift", "time_tracking_employeelocation",
    ]:
        run(f'UPDATE "{s}"."{tbl}" SET "employee_id" = NULL WHERE "employee_id" IN ({ep})', emp_ids)
        run(f'DELETE FROM "{s}"."{tbl}" WHERE "employee_id" IN ({ep})', emp_ids)

    run(f'DELETE FROM "{s}"."employees_employee" WHERE "id" IN ({ep})', emp_ids)

# ── Step 4: Delete the users ──────────────────────────────────────────────────
print(f"\n--- Deleting {len(delete_ids)} users ---")
try:
    cur.execute(f'DELETE FROM "accounts_user" WHERE "id" IN ({ph})', delete_ids)
    print(f"  SUCCESS: {cur.rowcount} users deleted!")
except Exception as e:
    print(f"  FAILED: {e}")

# ── Final report ──────────────────────────────────────────────────────────────
cur.execute('SELECT id, email FROM "accounts_user" ORDER BY email')
remaining = cur.fetchall()
print(f"\n{'='*50}")
print(f"REMAINING USERS: {len(remaining)}")
print('='*50)
for r in remaining:
    print(f"  ID={r[0]}  email={r[1]}")
print()

cur.close()
conn.close()
