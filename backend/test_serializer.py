import django
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")
django.setup()

from accounts.serializers import UserSerializer
from django.contrib.auth import get_user_model

User = get_user_model()
u = User.objects.get(email="kalyanit@gmail.com")
s = UserSerializer(u)
try:
    print(s.data)
except Exception as e:
    print("ERROR:", e)
