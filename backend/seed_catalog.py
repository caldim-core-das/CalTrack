import os
import django
import sys

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from service_requests.models import CatalogCategory, CatalogService

# User provided categories and services
CATEGORIES_DATA = {
    "Home Cleaning": {
        "slug": "cleaning",
        "image": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&q=80&fit=crop",
        "desc": "Deep clean & sanitization",
        "services": [
            {"name": "Deep Home Cleaning", "payment": "ONLINE_ONLY", "price": 2499, "duration": "4 hrs"},
            {"name": "Bathroom Cleaning", "payment": "BOTH", "price": 499, "duration": "1 hr"},
            {"name": "Kitchen Cleaning", "payment": "BOTH", "price": 699, "duration": "1 hr"},
            {"name": "Sofa Cleaning", "payment": "BOTH", "price": 599, "duration": "1 hr"},
            {"name": "Carpet Cleaning", "payment": "BOTH", "price": 499, "duration": "1 hr"},
            {"name": "Mattress Cleaning", "payment": "BOTH", "price": 399, "duration": "1 hr"},
            {"name": "Window Cleaning", "payment": "BOTH", "price": 299, "duration": "1 hr"},
            {"name": "Standard Package", "payment": "BOTH", "price": 999, "duration": "2 hrs"},
            {"name": "Premium Package", "payment": "ONLINE_ONLY", "price": 2499, "duration": "4 hrs"},
            {"name": "Move-In / Move-Out", "payment": "ONLINE_ONLY", "price": 3499, "duration": "6 hrs"}
        ]
    },
    "Plumbing": {
        "slug": "plumbing",
        "image": "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=500&q=80&fit=crop",
        "desc": "Leaks, pipes & fixtures",
        "services": [
            {"name": "Tap Repair", "payment": "BOTH", "price": 199, "duration": "30 min"},
            {"name": "Pipe Leakage Repair", "payment": "BOTH", "price": 299, "duration": "1 hr"},
            {"name": "Wash Basin Repair", "payment": "BOTH", "price": 299, "duration": "1 hr"},
            {"name": "Toilet Repair", "payment": "BOTH", "price": 399, "duration": "1 hr"},
            {"name": "Shower Installation", "payment": "BOTH", "price": 499, "duration": "1 hr"},
            {"name": "Drain Block Removal", "payment": "BOTH", "price": 599, "duration": "2 hrs"},
            {"name": "Water Motor Installation", "payment": "BOTH", "price": 799, "duration": "2 hrs"},
            {"name": "Standard Package", "payment": "BOTH", "price": 299, "duration": "1 hr"},
            {"name": "Premium Package", "payment": "ONLINE_ONLY", "price": 799, "duration": "2 hrs"},
            {"name": "Complete Home Plumbing", "payment": "ONLINE_ONLY", "price": 1999, "duration": "3 hrs"}
        ]
    },
    "Electrical": {
        "slug": "electrical",
        "image": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&q=80&fit=crop",
        "desc": "Wiring, panels & lighting",
        "services": [
            {"name": "Fan Repair", "payment": "BOTH", "price": 149, "duration": "30 min"},
            {"name": "Switch Board Repair", "payment": "BOTH", "price": 199, "duration": "30 min"},
            {"name": "Light Installation", "payment": "BOTH", "price": 149, "duration": "30 min"},
            {"name": "Ceiling Fan Installation", "payment": "BOTH", "price": 249, "duration": "45 min"},
            {"name": "Wiring Repair", "payment": "BOTH", "price": 299, "duration": "1 hr"},
            {"name": "Power Socket Installation", "payment": "BOTH", "price": 199, "duration": "30 min"},
            {"name": "MCB Replacement", "payment": "BOTH", "price": 349, "duration": "1 hr"},
            {"name": "Standard Package", "payment": "BOTH", "price": 299, "duration": "1 hr"},
            {"name": "Premium Package", "payment": "ONLINE_ONLY", "price": 899, "duration": "2 hrs"},
            {"name": "Home Electrical Care", "payment": "ONLINE_ONLY", "price": 1999, "duration": "3 hrs"}
        ]
    },
    "Carpentry": {
        "slug": "carpentry",
        "image": "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500&q=80&fit=crop",
        "desc": "Furniture & wood repairs",
        "services": [
            {"name": "Door Repair", "payment": "BOTH", "price": 299, "duration": "1 hr"},
            {"name": "Furniture Assembly", "payment": "BOTH", "price": 399, "duration": "2 hrs"},
            {"name": "Wardrobe Repair", "payment": "BOTH", "price": 499, "duration": "2 hrs"},
            {"name": "Shelf Installation", "payment": "BOTH", "price": 249, "duration": "1 hr"},
            {"name": "Curtain Rod Installation", "payment": "BOTH", "price": 199, "duration": "45 min"},
            {"name": "Cabinet Repair", "payment": "BOTH", "price": 349, "duration": "1 hr"},
            {"name": "Door Lock Replacement", "payment": "BOTH", "price": 299, "duration": "1 hr"},
            {"name": "Standard Repair", "payment": "BOTH", "price": 499, "duration": "2 hrs"},
            {"name": "Premium Setup", "payment": "ONLINE_ONLY", "price": 999, "duration": "4 hrs"},
            {"name": "Full Day Carpentry", "payment": "ONLINE_ONLY", "price": 1999, "duration": "8 hrs"}
        ]
    },
    "AC & Heating": {
        "slug": "hvac",
        "image": "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=500&q=80&fit=crop",
        "desc": "AC service & installation",
        "services": [
            {"name": "AC General Service", "payment": "BOTH", "price": 599, "duration": "1 hr"},
            {"name": "AC Deep Cleaning", "payment": "BOTH", "price": 899, "duration": "1.5 hrs"},
            {"name": "AC Installation", "payment": "ONLINE_ONLY", "price": 1499, "duration": "2 hrs"},
            {"name": "AC Uninstallation", "payment": "BOTH", "price": 799, "duration": "1 hr"},
            {"name": "Gas Refilling", "payment": "ONLINE_ONLY", "price": 1999, "duration": "1 hr"},
            {"name": "Cooling Issue Repair", "payment": "BOTH", "price": 499, "duration": "1 hr"},
            {"name": "Water Leakage Repair", "payment": "BOTH", "price": 399, "duration": "1 hr"},
            {"name": "Standard Package", "payment": "BOTH", "price": 599, "duration": "1 hr"},
            {"name": "Premium Package", "payment": "ONLINE_ONLY", "price": 1299, "duration": "2.5 hrs"},
            {"name": "AMC (Annual Maintenance Contract)", "payment": "ONLINE_ONLY", "price": 2999, "duration": "Yearly"}
        ]
    },
    "Pest Control": {
        "slug": "pest_control",
        "image": "https://images.unsplash.com/photo-1517825738774-7de9363ef735?w=500&q=80&fit=crop",
        "desc": "Termites, cockroaches & more",
        "services": [
            {"name": "Cockroach Control", "payment": "ONLINE_ONLY", "price": 799, "duration": "1 hr"},
            {"name": "Termite Treatment", "payment": "ONLINE_ONLY", "price": 1499, "duration": "2 hrs"},
            {"name": "Bed Bug Control", "payment": "ONLINE_ONLY", "price": 1299, "duration": "2 hrs"},
            {"name": "Mosquito Control", "payment": "ONLINE_ONLY", "price": 899, "duration": "1 hr"},
            {"name": "Ant Control", "payment": "ONLINE_ONLY", "price": 699, "duration": "1 hr"},
            {"name": "Rodent Control", "payment": "ONLINE_ONLY", "price": 999, "duration": "1.5 hrs"},
            {"name": "Home Pest Inspection", "payment": "BOTH", "price": 299, "duration": "30 min"},
            {"name": "Basic Pest Control", "payment": "ONLINE_ONLY", "price": 799, "duration": "1 hr"},
            {"name": "Comprehensive Treatment", "payment": "ONLINE_ONLY", "price": 1499, "duration": "2 hrs"},
            {"name": "Annual Pest Protection", "payment": "ONLINE_ONLY", "price": 3499, "duration": "Yearly"}
        ]
    },
    "Painting": {
        "slug": "painting",
        "image": "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=500&q=80&fit=crop",
        "desc": "Walls, ceilings & textures",
        "services": [
            {"name": "Interior Painting", "payment": "ONLINE_ONLY", "price": 2999, "duration": "1 day"},
            {"name": "Exterior Painting", "payment": "ONLINE_ONLY", "price": 4999, "duration": "2 days"},
            {"name": "Wall Putty", "payment": "BOTH", "price": 999, "duration": "4 hrs"},
            {"name": "Texture Painting", "payment": "ONLINE_ONLY", "price": 3999, "duration": "1 day"},
            {"name": "Waterproof Coating", "payment": "ONLINE_ONLY", "price": 2499, "duration": "1 day"},
            {"name": "Ceiling Painting", "payment": "BOTH", "price": 1499, "duration": "6 hrs"},
            {"name": "Wall Crack Repair", "payment": "BOTH", "price": 499, "duration": "2 hrs"},
            {"name": "Single Room Makeover", "payment": "ONLINE_ONLY", "price": 2999, "duration": "1 day"},
            {"name": "Complete Home Painting", "payment": "ONLINE_ONLY", "price": 9999, "duration": "4 days"},
            {"name": "Texture & Decor Painting", "payment": "ONLINE_ONLY", "price": 14999, "duration": "5 days"}
        ]
    },
    "Appliances": {
        "slug": "appliance_repair",
        "image": "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500&q=80&fit=crop",
        "desc": "Fridge, washer & oven repairs",
        "services": [
            {"name": "Washing Machine Repair", "payment": "BOTH", "price": 399, "duration": "1 hr"},
            {"name": "Refrigerator Repair", "payment": "BOTH", "price": 449, "duration": "1 hr"},
            {"name": "Water Purifier Service", "payment": "BOTH", "price": 299, "duration": "45 min"},
            {"name": "Geyser Repair", "payment": "BOTH", "price": 349, "duration": "1 hr"},
            {"name": "Microwave Repair", "payment": "BOTH", "price": 299, "duration": "45 min"},
            {"name": "Chimney Cleaning", "payment": "BOTH", "price": 599, "duration": "1.5 hrs"},
            {"name": "TV Installation", "payment": "BOTH", "price": 399, "duration": "1 hr"},
            {"name": "Standard Package", "payment": "BOTH", "price": 399, "duration": "1 hr"},
            {"name": "Premium Package", "payment": "ONLINE_ONLY", "price": 999, "duration": "2 hrs"},
            {"name": "Annual Care Plan", "payment": "ONLINE_ONLY", "price": 2499, "duration": "Yearly"}
        ]
    },
    "Security Systems": {
        "slug": "security",
        "image": "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=500&q=80&fit=crop",
        "desc": "CCTV & alarm systems",
        "services": [
            {"name": "CCTV Installation", "payment": "ONLINE_ONLY", "price": 1499, "duration": "2 hrs"},
            {"name": "CCTV Repair", "payment": "BOTH", "price": 499, "duration": "1 hr"},
            {"name": "Smart Door Lock Installation", "payment": "ONLINE_ONLY", "price": 999, "duration": "1.5 hrs"},
            {"name": "Alarm System Installation", "payment": "ONLINE_ONLY", "price": 1299, "duration": "2 hrs"},
            {"name": "Video Door Phone Installation", "payment": "ONLINE_ONLY", "price": 899, "duration": "1.5 hrs"},
            {"name": "Motion Sensor Installation", "payment": "ONLINE_ONLY", "price": 599, "duration": "1 hr"},
            {"name": "DVR Setup", "payment": "ONLINE_ONLY", "price": 499, "duration": "1 hr"},
            {"name": "System Check", "payment": "BOTH", "price": 499, "duration": "1 hr"},
            {"name": "2-Camera Setup", "payment": "ONLINE_ONLY", "price": 2999, "duration": "3 hrs"},
            {"name": "4-Camera Setup", "payment": "ONLINE_ONLY", "price": 4999, "duration": "5 hrs"}
        ]
    },
    "General Repair": {
        "slug": "general",
        "image": "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=500&q=80&fit=crop",
        "desc": "Handyman & misc tasks",
        "services": [
            {"name": "TV Wall Mounting", "payment": "BOTH", "price": 349, "duration": "1 hr"},
            {"name": "Furniture Assembly", "payment": "BOTH", "price": 399, "duration": "1.5 hrs"},
            {"name": "Mirror Installation", "payment": "BOTH", "price": 249, "duration": "45 min"},
            {"name": "Curtain Rod Installation", "payment": "BOTH", "price": 199, "duration": "45 min"},
            {"name": "Shelf Installation", "payment": "BOTH", "price": 249, "duration": "1 hr"},
            {"name": "Door Lock Repair", "payment": "BOTH", "price": 299, "duration": "1 hr"},
            {"name": "Wall Repair", "payment": "BOTH", "price": 399, "duration": "1 hr"},
            {"name": "1-Hour Handyman", "payment": "BOTH", "price": 299, "duration": "1 hr"},
            {"name": "2-Hour Handyman", "payment": "BOTH", "price": 499, "duration": "2 hrs"},
            {"name": "Full Day Pro", "payment": "ONLINE_ONLY", "price": 999, "duration": "8 hrs"}
        ]
    }
}

from django_tenants.utils import schema_context
from companies.models import Company

def seed():
    tenants = Company.objects.exclude(schema_name="public")
    for tenant in tenants:
        with schema_context(tenant.schema_name):
            print(f"Seeding for tenant: {tenant.schema_name}...")
            CatalogCategory.objects.all().delete()
            CatalogService.objects.all().delete()
            
            for cat_name, data in CATEGORIES_DATA.items():
                category = CatalogCategory.objects.create(
                    name=cat_name,
                    slug=data["slug"],
                    image=data["image"],
                    desc=data["desc"]
                )
                for srv in data["services"]:
                    CatalogService.objects.create(
                        category=category,
                        name=srv["name"],
                        price=srv["price"],
                        duration=srv["duration"],
                        payment_policy=srv["payment"]
                    )
            print(f"Finished seeding tenant: {tenant.schema_name}")
            
    print("All databases seeded successfully with categories and services.")

if __name__ == '__main__':
    seed()
