import os
import django
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'), override=True)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from accounts.models import User

out_file = os.path.join(BASE_DIR, 'user_info_output.txt')
with open(out_file, 'w', encoding='utf-8') as f:
    users = User.objects.all()
    f.write(f"Total users: {users.count()}\n")
    for u in users:
        f.write(f"ID: {u.id} | Username: {u.username} | Email: '{u.email}' | Role: '{u.role}' | Staff: {u.is_staff} | Superuser: {u.is_superuser} | Company: {u.company_id}\n")

print("Wrote user info to file")
