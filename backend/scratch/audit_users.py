import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from companies.models import Company

User = get_user_model()

print("--- User & Company Audit ---")
for user in User.objects.all():
    print(f"User: {user.username}, Role: {user.role}, Company: {user.company}")

print("\n--- Companies ---")
for company in Company.objects.all():
    print(f"Company: {company.company_name}, Schema: {company.schema_name}")

# Fix: If 'admin' user exists and has no company, but there is a company, link them.
admin = User.objects.filter(username="admin").first()
if admin and not admin.company:
    company = Company.objects.first()
    if company:
        admin.company = company
        admin.save()
        print(f"\n[FIXED] Linked user 'admin' to company '{company.company_name}'")
    else:
        print("\n[WARN] No companies found to link to admin.")
