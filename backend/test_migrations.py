import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from django.db import connection
from django_tenants.utils import schema_context

for schema in ['public', 'caldim-core-das']:
    print(f"--- Schema {schema} ---")
    with schema_context(schema):
        cursor = connection.cursor()
        cursor.execute("SELECT name FROM django_migrations WHERE app='service_requests' ORDER BY id DESC LIMIT 5")
        print(cursor.fetchall())
