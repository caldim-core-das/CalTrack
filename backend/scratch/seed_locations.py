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
from companies.models import Company

with schema_context('demo'):
    company = Company.objects.get(schema_name='demo')
    
    # Check if locations already exist
    if Location.objects.exists():
        print("Locations already exist in demo schema.")
    else:
        # Create some default locations
        loc1 = Location.objects.create(
            company=company,
            name="Headquarters Office",
            address="123 Corporate Way, City Center",
            lat=13.0827,
            lng=80.2707,
            geofence_radius=300,
            location_type="office"
        )
        loc2 = Location.objects.create(
            company=company,
            name="Main Warehouse / Depot",
            address="Plot 45, Industrial Zone East",
            lat=13.0900,
            lng=80.2900,
            geofence_radius=500,
            location_type="warehouse"
        )
        loc3 = Location.objects.create(
            company=company,
            name="Metro Station Project Site",
            address="Metro Construction Site Line 2",
            lat=13.0600,
            lng=80.2500,
            geofence_radius=400,
            location_type="job_site"
        )
        print("Successfully seeded 3 default locations in the 'demo' schema:")
        print(f"  - {loc1.name} (Office)")
        print(f"  - {loc2.name} (Warehouse)")
        print(f"  - {loc3.name} (Job Site)")
