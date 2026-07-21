"""
Get ALL FK constraints referencing accounts_user across all tenant schemas.
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

# Find ALL FK references to accounts_user across ALL schemas
cur.execute("""
    SELECT DISTINCT
        tc.table_schema,
        tc.table_name,
        kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'accounts_user'
    ORDER BY tc.table_schema, tc.table_name, kcu.column_name
""")
rows = cur.fetchall()
print(f"\nAll FK references to accounts_user ({len(rows)} found):\n")
for r in rows:
    print(f"  {r[0]}.{r[1]}.{r[2]}")
cur.close()
conn.close()
