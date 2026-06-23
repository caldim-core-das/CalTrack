import os
import django

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
from pathlib import Path
from dotenv import load_dotenv
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)
django.setup()

from django_tenants.utils import schema_context
from companies.models import Company
from settings_hub.models import TeamInvite
from django.utils import timezone

def print_invites():
    print(f"Current server time: {timezone.now()}")
    for company in Company.objects.exclude(schema_name="public"):
        with schema_context(company.schema_name):
            invites = TeamInvite.objects.all()
            print(f"\nSchema: {company.schema_name} (Company: {company.company_name})")
            if not invites.exists():
                print("  No invites found.")
            for invite in invites:
                print(f"  - Email: {invite.email}")
                print(f"    Token: {invite.token}")
                print(f"    Status: {invite.status}")
                print(f"    Expires At: {invite.expires_at}")
                print(f"    Is Expired (timezone comparison): {timezone.now() > invite.expires_at}")

if __name__ == "__main__":
    print_invites()
