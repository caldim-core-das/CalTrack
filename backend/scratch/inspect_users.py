import os
import sys
import django

# Set up path
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

# Set up Django
os.environ["DJANGO_SETTINGS_MODULE"] = "quicktims.settings"
os.environ["DJANGO_SECRET_KEY"] = "dev-only-secret-key-change-me"
os.environ["DB_NAME"] = "caltrack"
os.environ["DB_USER"] = "caltrack_user"
os.environ["DB_PASSWORD"] = "caltrack_pass"
os.environ["DB_HOST"] = "localhost"

django.setup()

from django.contrib.auth import get_user_model
U = get_user_model()
users = U.objects.filter(email='chiyaans787@gmail.com')
for u in users:
    print(f'User ID={u.id} | username={u.username} | role={u.role} | is_active={u.is_active} | company={getattr(u, "company", None)}')
