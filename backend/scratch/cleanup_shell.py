import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from django.db import connection
from django.contrib.auth import get_user_model
User = get_user_model()

KEEP = {'chiyaans787@gmail.com', 'suryacaldim@gmail.com'}
delete_ids = [u.pk for u in User.objects.all() if u.email not in KEEP]
ph = ','.join(['%s'] * len(delete_ids))
print('Deleting user IDs:', delete_ids)

def run(cur, sql, params=()):
    try:
        cur.execute(sql, params)
        if cur.rowcount:
            print(' DEL', cur.rowcount, sql[:85])
    except Exception as e:
        err = str(e)
        if 'does not exist' not in err and 'undefined' not in err.lower():
            print(' ERR:', err[:120])

# Step 1: Get all FK refs to accounts_user with nullability
with connection.cursor() as cur:
    cur.execute("""
        SELECT tc.table_schema, tc.table_name, kcu.column_name, col.is_nullable
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name=tc.constraint_name
        JOIN information_schema.columns col
            ON col.table_schema=tc.table_schema AND col.table_name=tc.table_name
            AND col.column_name=kcu.column_name
        WHERE tc.constraint_type='FOREIGN KEY' AND ccu.table_name='accounts_user'
        ORDER BY tc.table_schema, tc.table_name
    """)
    fk_refs = cur.fetchall()
print(f'FK refs: {len(fk_refs)}')

# Step 2: NULL or delete each FK ref
for schema, table, col, nullable in fk_refs:
    if schema == 'public' and table == 'accounts_user':
        continue
    with connection.cursor() as cur:
        if nullable == 'YES':
            run(cur, f'UPDATE "{schema}"."{table}" SET "{col}"=NULL WHERE "{col}" IN ({ph})', delete_ids)
        else:
            run(cur, f'DELETE FROM "{schema}"."{table}" WHERE "{col}" IN ({ph})', delete_ids)

# Step 3: Employee FK children
SCHEMAS = ['caldim', 'caldim_2', 'caldim_engg', 'dd', 'ddd', 'demo', 'kalyani_co', 'rohit', 'test_co_123']
CHILD_TABLES = [
    'time_tracking_timelog', 'employees_presencelog', 'compliance_auditlog',
    'compliance_breakattestation', 'compliance_holidayaccrual', 'compliance_overtimealert',
    'compliance_righttowork', 'compliance_wtroptout',
    'payroll_payrollrecord', 'payroll_payrollgeneration',
    'live_locations_employeelocation', 'live_locations_geofencebreach', 'live_locations_sosalert',
    'mileage_mileagetrip', 'mileage_mileageytdtracker',
    'service_requests_servicerequest', 'service_requests_employeejob',
    'service_requests_employeeperformance', 'service_requests_jobcompletionproof',
    'leaves_leaverequest', 'inventory_inventoryissuance', 'inventory_inventoryalert',
    'scheduling_shift', 'time_tracking_employeelocation',
]
for s in SCHEMAS:
    with connection.cursor() as cur:
        try:
            cur.execute(f'SELECT id FROM "{s}"."employees_employee" WHERE user_id IN ({ph})', delete_ids)
            emp_ids = [r[0] for r in cur.fetchall()]
        except Exception:
            emp_ids = []
    if not emp_ids:
        continue
    ep = ','.join(['%s'] * len(emp_ids))
    print(f'[{s}] employees: {emp_ids}')
    for tbl in CHILD_TABLES:
        with connection.cursor() as cur:
            run(cur, f'UPDATE "{s}"."{tbl}" SET employee_id=NULL WHERE employee_id IN ({ep})', emp_ids)
            run(cur, f'DELETE FROM "{s}"."{tbl}" WHERE employee_id IN ({ep})', emp_ids)
    with connection.cursor() as cur:
        run(cur, f'DELETE FROM "{s}"."employees_employee" WHERE id IN ({ep})', emp_ids)

# Step 4: Delete users
with connection.cursor() as cur:
    try:
        cur.execute(f'DELETE FROM accounts_user WHERE id IN ({ph})', delete_ids)
        print('SUCCESS: deleted', cur.rowcount, 'users')
    except Exception as e:
        print('FAILED:', e)

print('Remaining users:', User.objects.count())
for u in User.objects.all().order_by('email'):
    print(' ', u.email, getattr(u, 'role', 'N/A'))
