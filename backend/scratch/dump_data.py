"""
dump_data.py — UTF-8 safe dumpdata wrapper for Windows.
Run: python dump_data.py
"""
import os
import sys
import io
import django

# Add backend root to path so quicktims package is found
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_ROOT)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
os.environ["DJANGO_SECRET_KEY"] = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key-12345")
os.environ["DJANGO_ALLOWED_HOSTS"] = "*"
os.environ["PYTHONIOENCODING"] = "utf-8"

django.setup()

from django.core.management import call_command

# Write dumpdata output to a UTF-8 file
output_path = os.path.join(os.path.dirname(__file__), "data_dump.json")
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

print(f"✅ Data dumped to {output_path}")

# Show file size
size_kb = os.path.getsize(output_path) / 1024
print(f"   File size: {size_kb:.1f} KB")
