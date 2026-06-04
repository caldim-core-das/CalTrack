import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from companies.models import Domain

print("--- Domains ---")
for d in Domain.objects.all():
    print(f"Domain: {d.domain}, Tenant: {d.tenant.company_name}, Schema: {d.tenant.schema_name}")
