import os, sys, io, django
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')
os.environ['DJANGO_SETTINGS_MODULE'] = 'quicktims.settings'
django.setup()
from django.db import connection
with connection.cursor() as cur:
    cur.execute("""
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_name LIKE '%employee%'
        ORDER BY table_schema, table_name
        LIMIT 60
    """)
    for r in cur.fetchall():
        print(r[0], '|', r[1])
