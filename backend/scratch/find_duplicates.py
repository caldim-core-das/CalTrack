import os
import django
from django.db.models import Count

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from companies.models import Company, Domain
from employees.models import Employee

User = get_user_model()

print("=== Duplicate Companies ===")
duplicate_companies = Company.objects.values('company_name').annotate(name_count=Count('company_name')).filter(name_count__gt=1)
for dc in duplicate_companies:
    name = dc['company_name']
    count = dc['name_count']
    print(f"Company Name: '{name}' appears {count} times:")
    for c in Company.objects.filter(company_name=name):
        print(f"  - ID: {c.id}, Schema: {c.schema_name}, Display ID: {c.display_id}")

print("\n=== Duplicate Domains ===")
duplicate_domains = Domain.objects.values('domain').annotate(domain_count=Count('domain')).filter(domain_count__gt=1)
for dd in duplicate_domains:
    domain = dd['domain']
    count = dd['domain_count']
    print(f"Domain: '{domain}' appears {count} times:")
    for d in Domain.objects.filter(domain=domain):
        print(f"  - ID: {d.id}, Tenant: {d.tenant.company_name}")

print("\n=== Duplicate User Emails ===")
duplicate_emails = User.objects.values('email').exclude(email='').annotate(email_count=Count('email')).filter(email_count__gt=1)
for de in duplicate_emails:
    email = de['email']
    count = de['email_count']
    print(f"Email: '{email}' appears {count} times:")
    for u in User.objects.filter(email=email):
        print(f"  - Username: {u.username}, Role: {u.role}, Company: {u.company}")
