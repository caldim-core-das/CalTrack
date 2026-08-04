import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
import django
django.setup()

from django.db import connection
from companies.models import Company

with connection.cursor() as cursor:
    for c in Company.objects.exclude(schema_name='public'):
        s_name = c.schema_name
        if s_name and s_name.isidentifier():
            print(f"Ensuring schema '{s_name}' exists...")
            cursor.execute(f'CREATE SCHEMA IF NOT EXISTS "{s_name}"')

print("All company schemas checked and created.")
