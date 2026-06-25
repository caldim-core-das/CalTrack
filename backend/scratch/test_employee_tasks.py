import os
import django
import sys
from contextlib import contextmanager

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.db import connection
from django.contrib.auth import get_user_model
from companies.models import Company
from tasks.views.task_views import EmployeeTaskListView
from rest_framework.test import APIRequestFactory, force_authenticate

@contextmanager
def safe_schema_context(schema_name):
    if hasattr(connection, "tenant"):
        from django_tenants.utils import schema_context
        with schema_context(schema_name):
            yield
    else:
        yield

def test_api():
    User = get_user_model()
    company = Company.objects.filter(schema_name="caldim_engg").first()
    if not company:
        print("Company caldim_engg not found!")
        return

    with safe_schema_context(company.schema_name):
        surya = User.objects.filter(username="suryacaldim@gmail.com").first()
        if not surya:
            print("Surya user not found!")
            return

        print(f"Testing as user: {surya.username} (ID: {surya.id})")
        factory = APIRequestFactory()
        view = EmployeeTaskListView.as_view()
        request = factory.get("/api/tasks/my/")
        force_authenticate(request, user=surya)
        request.company = company
        
        response = view(request)
        print("Response status:", response.status_code)
        
        results = []
        if hasattr(response, 'data'):
            if isinstance(response.data, list):
                results = response.data
            elif isinstance(response.data, dict) and 'results' in response.data:
                results = response.data['results']
                
        print("Response data count:", len(results))
        for t in results:
            print(f"Task ID: {t.get('id')}, Title: {t.get('title')}, Status: {t.get('status')}, Acceptance Status: {t.get('acceptance_status')}")

if __name__ == "__main__":
    test_api()
