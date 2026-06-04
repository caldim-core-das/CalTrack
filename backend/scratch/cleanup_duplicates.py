import os
import time
import django
from django.db import connection, transaction

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")

# Retry connection setup up to 5 times if pool is full
for attempt in range(1, 6):
    try:
        django.setup()
        # Force a database connection check
        connection.ensure_connection()
        print(f"Successfully connected to database on attempt {attempt}")
        break
    except Exception as e:
        print(f"Connection attempt {attempt} failed: {e}")
        if attempt == 5:
            print("Could not connect to database. Exiting.")
            exit(1)
        time.sleep(2)

# Free up other connections
try:
    with connection.cursor() as cursor:
        print("Terminating other idle connections to free up pool...")
        cursor.execute("""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND state = 'idle';
        """)
        terminated_count = cursor.rowcount
        print(f"Terminated {terminated_count} idle connections.")
except Exception as e:
    print(f"Warning: Could not terminate idle connections: {e}")

from companies.models import Company
from employees.models import Employee

print("\n=== STARTING DUPLICATE CLEANUP ===")

# Group companies by name (case-insensitive)
company_groups = {}
for c in Company.objects.all():
    if c.schema_name == 'public':
        continue
    name_lower = c.company_name.lower().strip()
    company_groups.setdefault(name_lower, []).append(c)

for name, companies in company_groups.items():
    if len(companies) <= 1:
        continue
        
    print(f"\nProcessing duplicate company group: '{name}'")
    
    schema_stats = []
    for c in companies:
        try:
            connection.set_tenant(c)
            emp_count = Employee.objects.count()
        except Exception as e:
            print(f"  Error setting tenant for schema {c.schema_name}: {e}")
            emp_count = -1
        schema_stats.append((c, emp_count))
        print(f"  - ID: {c.id}, Schema: {c.schema_name}, Employee count: {emp_count}")
        
    schema_stats.sort(key=lambda x: (-x[1], x[0].id))
    best_candidate, best_count = schema_stats[0]
    
    print(f"  --> DECISION: Keeping ID: {best_candidate.id}, Schema: {best_candidate.schema_name} (Employees: {best_count})")
    
    for c, emp_count in schema_stats[1:]:
        print(f"  --> DELETING duplicate ID: {c.id}, Schema: {c.schema_name}")
        try:
            connection.set_schema_to_public()
            # Explicitly close any connections/cursors before deletion
            c.delete()
            print(f"      Successfully deleted ID {c.id} / Schema {c.schema_name}")
        except Exception as e:
            print(f"      Error deleting ID {c.id}: {e}")

print("\n=== DUPLICATE CLEANUP COMPLETED ===")
