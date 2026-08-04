import datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError

from .models import SavedAddress
from . import customer_services

User = get_user_model()


class SavedAddressTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="customer_test",
            email="customer@example.com",
            password="Password123!",
            role="customer",
            first_name="Customer",
            last_name="Test"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_and_list_saved_addresses(self):
        addr1 = customer_services.create_saved_address(self.user, {
            "label": "home",
            "address_line1": "123 Main St",
            "city": "New York",
            "state": "NY",
            "pincode": "10001",
            "phone_number": "+1555123456"
        })
        self.assertTrue(addr1.is_default)
        self.assertEqual(addr1.phone_number, "+1555123456")

        addr2 = customer_services.create_saved_address(self.user, {
            "label": "work",
            "address_line1": "456 Market St",
            "city": "New York",
            "state": "NY",
            "pincode": "10002",
            "is_default": True
        })
        addr1.refresh_from_db()
        self.assertFalse(addr1.is_default)
        self.assertTrue(addr2.is_default)

        addresses = customer_services.list_saved_addresses(self.user)
        self.assertEqual(addresses[0].id, addr2.id)

    def test_set_default_address(self):
        addr1 = customer_services.create_saved_address(self.user, {
            "label": "home",
            "address_line1": "123 Main St",
            "city": "New York",
            "state": "NY",
            "pincode": "10001",
            "is_default": True
        })
        addr2 = customer_services.create_saved_address(self.user, {
            "label": "work",
            "address_line1": "456 Market St",
            "city": "New York",
            "state": "NY",
            "pincode": "10002",
            "is_default": False
        })

        customer_services.set_default_address(self.user, addr2.id)
        addr1.refresh_from_db()
        addr2.refresh_from_db()
        self.assertFalse(addr1.is_default)
        self.assertTrue(addr2.is_default)

    def test_delete_default_address_blocked(self):
        addr1 = customer_services.create_saved_address(self.user, {
            "label": "home",
            "address_line1": "123 Main St",
            "city": "New York",
            "state": "NY",
            "pincode": "10001",
            "is_default": True
        })
        addr2 = customer_services.create_saved_address(self.user, {
            "label": "work",
            "address_line1": "456 Market St",
            "city": "New York",
            "state": "NY",
            "pincode": "10002",
            "is_default": False
        })

        with self.assertRaises(ValidationError):
            customer_services.delete_saved_address(self.user, addr1.id)

    def test_mark_address_used_and_serviceability(self):
        addr = customer_services.create_saved_address(self.user, {
            "label": "home",
            "address_line1": "789 Pine St",
            "city": "Chicago",
            "state": "IL",
            "pincode": "60601"
        })
        self.assertIsNone(addr.last_used_at)

        updated = customer_services.mark_address_used(self.user, addr.id)
        self.assertIsNotNone(updated.last_used_at)

        check = customer_services.check_address_serviceability(addr)
        self.assertTrue(check["available"])

    def test_address_api_endpoints(self):
        res = self.client.post("/api/auth/customer/addresses/", {
            "label": "home",
            "address_line1": "999 Oak St",
            "city": "Boston",
            "state": "MA",
            "pincode": "02108",
            "phone_number": "+1555999888"
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data["success"])
        addr_id = res.data["data"]["id"]

        # Serviceability endpoint
        res2 = self.client.get(f"/api/auth/customer/addresses/{addr_id}/serviceability/")
        self.assertEqual(res2.status_code, 200)
        self.assertTrue(res2.data["data"]["available"])

        # Mark used endpoint
        res3 = self.client.post(f"/api/auth/customer/addresses/{addr_id}/mark-used/")
        self.assertEqual(res3.status_code, 200)
        self.assertIsNotNone(res3.data["data"]["last_used_at"])
