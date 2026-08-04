"""
Dump complete SQLite database (SHARED_APPS + TENANT_APPS) to data_dump_full.json
"""
import os
import sys
import io

# Temporarily point settings to SQLite single database
os.environ["DB_NAME"] = ""
os.environ["DB_HOST"] = ""
os.environ["DJANGO_SETTINGS_MODULE"] = "quicktims.settings"
os.environ["DJANGO_SECRET_KEY"] = "dev-secret-key-12345"
os.environ["DJANGO_ALLOWED_HOSTS"] = "*"

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)

import django
django.setup()

from django.core.management import call_command

output_path = os.path.join(BACKEND_ROOT, "data_dump_full.json")
with io.open(output_path, "w", encoding="utf-8") as f:
    call_command(
        "dumpdata",
        "--exclude", "auth.permission",
        "--exclude", "contenttypes",
        "--exclude", "sessions",
        "--natural-foreign",
        "--natural-primary",
        "--indent", "2",
        stdout=f,
    )

print(f"Dumped complete SQLite data to {output_path}")

import json
data = json.load(open(output_path, encoding='utf-8'))
models = {}
for item in data:
    models[item['model']] = models.get(item['model'], 0) + 1

print("\nModel record breakdown in dump:")
for m, c in sorted(models.items()):
    print(f"  {m}: {c}")
print(f"\nTotal objects: {len(data)}")
