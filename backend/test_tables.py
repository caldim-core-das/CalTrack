import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from django.db import connection
from django_tenants.utils import schema_context

with schema_context('caldim-core-das'):
    cursor = connection.cursor()
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='caldim-core-das' AND table_name LIKE '%complaint%'")
    print(cursor.fetchall())
