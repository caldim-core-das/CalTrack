import os
import sys

# Ensure backend directory is in python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from django_tenants.utils import schema_context
from time_tracking.models import Location

with schema_context('demo'):
    locations = Location.objects.all()
    print(f"Total locations found: {locations.count()}")
    for loc in locations:
        print(f"ID: {loc.id} | Name: {loc.name} | Type: {loc.location_type} | Lat: {loc.lat} | Lng: {loc.lng}")
