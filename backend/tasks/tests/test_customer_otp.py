import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from companies.models import Company
from employees.models import Employee
from tasks.models import Task
from tasks.services.otp_service import generate_and_send_job_otp

User = get_user_model()


@pytest.fixture
def setup_data(db):
    company = Company.objects.create(company_name="Test Org")
    admin = User.objects.create_user(
        username="testadmin", email="admin@test.com", password="password123", role="admin", company=company
    )
    tech = User.objects.create_user(
        username="testtech", email="tech@test.com", password="password123", role="employee", company=company
    )
    Employee.objects.create(user=tech, company=company, employee_id="TECH1", is_active=True)

    task = Task.objects.create(
        company=company,
        title="AC Repair Task",
        assigned_to=tech,
        assigned_by=admin,
        acceptance_status=Task.AcceptanceStatus.ACCEPTED,
        status=Task.Status.PENDING,
        travel_status=Task.TravelStatus.REACHED_SITE,
        client_name="John Customer",
        client_contact_number="+1234567890",
        client_email="customer@example.com",
    )

    return {
        "company": company,
        "admin": admin,
        "tech": tech,
        "task": task,
    }


@pytest.mark.django_db
def test_otp_generation_and_dispatch(setup_data):
    task = setup_data["task"]
    otp = generate_and_send_job_otp(task)

    task.refresh_from_db()
    assert len(otp) == 6
    assert task.start_otp == otp
    assert task.is_otp_verified is False
    assert task.otp_created_at is not None


@pytest.mark.django_db
def test_start_work_requires_valid_otp(setup_data):
    tech = setup_data["tech"]
    task = setup_data["task"]

    # Generate OTP
    otp = generate_and_send_job_otp(task)

    client = APIClient()
    client.force_authenticate(user=tech)

    # 1. Attempt start_work without OTP -> Expect HTTP 400
    res_no_otp = client.post(f"/api/tasks/my/{task.id}/start_work/", {}, format="json")
    assert res_no_otp.status_code == status.HTTP_400_BAD_REQUEST
    assert "Customer OTP is required" in res_no_otp.data["detail"]

    # 2. Attempt start_work with wrong OTP -> Expect HTTP 400
    res_wrong_otp = client.post(f"/api/tasks/my/{task.id}/start_work/", {"otp": "000000"}, format="json")
    assert res_wrong_otp.status_code == status.HTTP_400_BAD_REQUEST
    assert "Invalid Customer OTP" in res_wrong_otp.data["detail"]

    # 3. Attempt start_work with correct OTP -> Expect Success (HTTP 200)
    res_success = client.post(f"/api/tasks/my/{task.id}/start_work/", {"otp": otp}, format="json")
    assert res_success.status_code == status.HTTP_200_OK

    task.refresh_from_db()
    assert task.is_otp_verified is True
    assert task.status == Task.Status.IN_PROGRESS


@pytest.mark.django_db
def test_resend_customer_otp_endpoint(setup_data):
    tech = setup_data["tech"]
    task = setup_data["task"]

    client = APIClient()
    client.force_authenticate(user=tech)

    res = client.post(f"/api/tasks/my/{task.id}/resend_otp/", {}, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert "dispatched" in res.data["detail"]

    task.refresh_from_db()
    assert len(task.start_otp) == 6
