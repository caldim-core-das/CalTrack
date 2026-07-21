# email_report.py - Full email & login breakdown from the database.
import os, sys, django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

# Force UTF-8 output on Windows
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from django.contrib.auth import get_user_model

User = get_user_model()

all_users = list(User.objects.all().order_by("email"))

# Categorise
superusers = [u for u in all_users if u.is_superuser]
staff      = [u for u in all_users if u.is_staff and not u.is_superuser]
admins     = [u for u in all_users if str(getattr(u, "role", "")).lower() == "admin"]
managers   = [u for u in all_users if str(getattr(u, "role", "")).lower() in ("manager", "gm")]
employees  = [u for u in all_users if str(getattr(u, "role", "")).lower() == "employee"]
active_u   = [u for u in all_users if u.is_active]
inactive_u = [u for u in all_users if not u.is_active]

SEP  = "=" * 64
DASH = "-" * 64

def show(label, users):
    print(f"\n{DASH}")
    print(f"  {label}  ({len(users)} accounts)")
    print(DASH)
    if not users:
        print("  (none)")
        return
    for u in users:
        role   = getattr(u, "role", "N/A")
        status = "active" if u.is_active else "INACTIVE"
        tenant = getattr(u, "tenant", None)
        org    = str(tenant) if tenant else "--"
        print(f"  {u.email:<42}  role={str(role):<12}  {status}  org={org}")

print(f"\n{SEP}")
print("       CALTRACK -- DATABASE EMAIL / LOGIN REPORT")
print(SEP)
print(f"  Total users in DB   : {len(all_users)}")
print(f"  Active  accounts    : {len(active_u)}")
print(f"  Inactive accounts   : {len(inactive_u)}")

show("SUPERUSERS  (is_superuser=True)", superusers)
show("STAFF  (is_staff=True, not superuser)", staff)
show("ADMINS  (role = admin)", admins)
show("MANAGERS / GMs  (role = manager / gm)", managers)
show("EMPLOYEES  (role = employee)", employees)

known = set(u.pk for lst in [superusers, staff, admins, managers, employees] for u in lst)
others = [u for u in all_users if u.pk not in known]
show("OTHER / UNCLASSIFIED", others)

print(f"\n{SEP}")
print("  END OF REPORT")
print(f"{SEP}\n")

# Per-tenant summary
try:
    from django_tenants.utils import get_tenant_model
    Tenant = get_tenant_model()
    tenants = list(Tenant.objects.all())
    if tenants:
        print(f"\n{SEP}")
        print("  PER-ORGANIZATION BREAKDOWN")
        print(SEP)
        for t in tenants:
            t_users = [u for u in all_users if getattr(u, "tenant", None) == t]
            print(f"\n  Org: {t}  ({len(t_users)} users)")
            for u in sorted(t_users, key=lambda x: x.email):
                role = getattr(u, "role", "N/A")
                print(f"    {u.email:<42}  role={role}")
        print()
except Exception:
    pass
