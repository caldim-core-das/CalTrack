import os
import django
import sys
from pathlib import Path
from dotenv import load_dotenv

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)
django.setup()

from django.contrib.auth import get_user_model
from companies.models import Company
from settings_hub.models import TeamInvite
from django_tenants.utils import schema_context
from employees.models import Employee
from employees.utils import generate_next_employee_id
from django.utils import timezone
import uuid

def simulate_google_login():
    User = get_user_model()
    email_clean = "suryaramya111111@gmail.com"
    
    print("Starting simulation for:", email_clean)
    
    # Prioritize the account that already has a company assigned
    user = User.objects.filter(email__iexact=email_clean, company__isnull=False).first()
    if not user:
        # Fallback to any account with this email
        user = User.objects.filter(email__iexact=email_clean).first()
        
    print("Found user:", user)
    if user:
        print("  User company:", user.company)
        print("  User role:", user.role)

    # Check if there is a pending team invitation for this email across all companies
    invite = None
    for company in Company.objects.exclude(schema_name="public"):
        with schema_context(company.schema_name):
            invite = TeamInvite.objects.filter(email__iexact=email_clean, status="pending").first()
            if invite:
                print("Found pending invite in company:", company.schema_name)
                break

    if not user and not invite:
        print("Blocked: No user and no invite.")
        return

    if invite:
        print("Processing invite...")
        if not user:
            print("Creating new user...")
            username = email_clean.split("@")[0]
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create_user(
                username=username,
                email=email_clean,
                password=uuid.uuid4().hex,
                first_name="Surya",
                last_name="Ramya",
                role=invite.role,
            )
            user.company = invite.company
            user.is_active = True
            user.save()
        else:
            print("Updating existing user...")
            user.is_active = True
            user.role = invite.role
            if not user.company:
                user.company = invite.company
            user.save()

        # Accept the invitation
        print("Accepting invite...")
        with schema_context(invite.company.schema_name):
            invite.status = "accepted"
            invite.accepted_at = timezone.now()
            invite.save()

        # Create/Activate Employee profile under the tenant schema
        print("Creating/activating employee profile...")
        with schema_context(invite.company.schema_name):
            employee, created = Employee.objects.get_or_create(
                user=user,
                company=invite.company,
                defaults={
                    "employee_id": generate_next_employee_id(invite.company),
                    "title": invite.role.title(),
                    "hourly_rate": 0.00,
                    "is_active": True
                }
            )
            print("Employee created:", created)
            if not created:
                employee.is_active = True
                employee.save()
                
    print("Simulation complete! No errors thrown.")

if __name__ == "__main__":
    try:
        simulate_google_login()
    except Exception as e:
        import traceback
        traceback.print_exc()
