import pytest
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError
from unittest.mock import patch, MagicMock

from companies.models import Company
from employees.models import Employee
from tasks.models import Task
from tasks.services import gap_job_service
from tasks.services.gap_job_service import ProximityError

User = get_user_model()

@pytest.fixture
def test_setup():
    """
    Creates basic database fixtures for testing:
    - 2 companies (tenant isolation testing)
    - 2 users per company (admin, worker)
    - 1 employee profile for each worker
    """
    # Company 1
    company1 = Company.objects.create(
        company_name="Company One",
        geofence_enabled=True,
        geofence_radius_meters=300
    )
    # Company 2 (Isolation test)
    company2 = Company.objects.create(
        company_name="Company Two",
        geofence_enabled=True,
        geofence_radius_meters=300
    )

    # Users for Company 1
    admin1 = User.objects.create_user(
        username="admin1", email="admin1@test.com", password="password", role="admin", company=company1
    )
    worker1 = User.objects.create_user(
        username="worker1", email="worker1@test.com", password="password", role="employee", company=company1
    )
    employee1 = Employee.objects.create(
        user=worker1, company=company1, employee_id="EMP1", is_active=True
    )

    # Users for Company 2
    worker2 = User.objects.create_user(
        username="worker2", email="worker2@test.com", password="password", role="employee", company=company2
    )
    employee2 = Employee.objects.create(
        user=worker2, company=company2, employee_id="EMP2", is_active=True
    )

    return {
        "company1": company1,
        "company2": company2,
        "admin1": admin1,
        "worker1": worker1,
        "employee1": employee1,
        "worker2": worker2,
        "employee2": employee2,
    }


@pytest.mark.django_db
def test_suspend_job_happy_path(test_setup):
    """✓ suspend_job snapshots seconds and sets correct status"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    # Create an in-progress task
    task = Task.objects.create(
        title="HVAC Check",
        status=Task.Status.IN_PROGRESS,
        company=company,
        assigned_to=worker,
        started_at=timezone.now() - timezone.timedelta(seconds=120)
    )

    suspended_task = gap_job_service.suspend_job(task.id, worker, reason="Waiting for spare parts")

    assert suspended_task.status == Task.Status.SUSPENDED
    assert suspended_task.suspend_reason == "Waiting for spare parts"
    assert suspended_task.suspended_at is not None
    assert suspended_task.total_active_seconds >= 120


@pytest.mark.django_db
def test_suspend_job_invalid_state(test_setup):
    """✓ suspend_job on non-InProgress task → ValidationError"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    task = Task.objects.create(
        title="Pending HVAC Job",
        status=Task.Status.PENDING,
        company=company,
        assigned_to=worker
    )

    with pytest.raises(ValidationError) as excinfo:
        gap_job_service.suspend_job(task.id, worker)
    
    assert "Only in-progress tasks can be suspended" in str(excinfo.value)


@pytest.mark.django_db
def test_get_available_gap_jobs_sorting(test_setup):
    """✓ get_available_gap_jobs returns jobs sorted nearest-first"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    # Create nearby available tasks (not assigned to this worker)
    # Target coordinate: 12.0, 80.0
    # Task 1 is closest (12.01, 80.01)
    task1 = Task.objects.create(
        title="Near Job",
        status=Task.Status.PENDING,
        company=company,
        assigned_to=test_setup["admin1"], # Not assigned to worker
        location_lat=12.01,
        location_lon=80.01
    )
    # Task 2 is further (12.10, 80.10)
    task2 = Task.objects.create(
        title="Far Job",
        status=Task.Status.PENDING,
        company=company,
        assigned_to=test_setup["admin1"],
        location_lat=12.10,
        location_lon=80.10
    )

    jobs = gap_job_service.get_available_gap_jobs(worker, lat=12.0, lng=80.0, radius_km=30)
    
    assert len(jobs) == 2
    assert jobs[0].id == task1.id
    assert jobs[1].id == task2.id
    assert jobs[0].distance_km < jobs[1].distance_km


@pytest.mark.django_db
def test_get_available_gap_jobs_excludes_taken_jobs(test_setup):
    """✓ get_available_gap_jobs excludes already-taken gap jobs"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    task_available = Task.objects.create(
        title="Free Job",
        status=Task.Status.PENDING,
        company=company,
        assigned_to=test_setup["admin1"],
        location_lat=12.01,
        location_lon=80.01
    )
    
    task_taken = Task.objects.create(
        title="Taken Job",
        status=Task.Status.PENDING,
        company=company,
        assigned_to=test_setup["admin1"],
        location_lat=12.01,
        location_lon=80.01
    )

    parent_job = Task.objects.create(
        title="Parent Job",
        status=Task.Status.SUSPENDED,
        company=company,
        assigned_to=worker,
        gap_job=task_taken
    )

    jobs = gap_job_service.get_available_gap_jobs(worker, lat=12.0, lng=80.0, radius_km=30)
    
    assert len(jobs) == 1
    assert jobs[0].id == task_available.id


@pytest.mark.django_db
def test_accept_gap_job_happy_path(test_setup):
    """✓ accept_gap_job links parent ↔ gap task correctly"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    parent = Task.objects.create(
        title="Suspended Parent",
        status=Task.Status.SUSPENDED,
        company=company,
        assigned_to=worker
    )
    gap = Task.objects.create(
        title="Gap Job",
        status=Task.Status.PENDING,
        company=company,
        assigned_to=test_setup["admin1"]
    )

    parent, gap = gap_job_service.accept_gap_job(gap.id, worker, parent.id)

    assert parent.gap_job_id == gap.id
    assert gap.status == Task.Status.IN_PROGRESS
    assert gap.assigned_to == worker
    assert gap.time_log is not None


@pytest.mark.django_db
def test_accept_gap_job_limit(test_setup):
    """✓ accept_gap_job when worker already has 2 suspended jobs → ValidationError"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    # Worker already has 2 suspended jobs
    Task.objects.create(title="Suspended 1", status=Task.Status.SUSPENDED, company=company, assigned_to=worker)
    Task.objects.create(title="Suspended 2", status=Task.Status.SUSPENDED, company=company, assigned_to=worker)
    
    parent3 = Task.objects.create(title="Suspended 3", status=Task.Status.SUSPENDED, company=company, assigned_to=worker)
    gap = Task.objects.create(title="Gap Job", status=Task.Status.PENDING, company=company, assigned_to=test_setup["admin1"])

    with pytest.raises(ValidationError) as excinfo:
        gap_job_service.accept_gap_job(gap.id, worker, parent3.id)
    
    assert "Maximum 2 suspended jobs allowed" in str(excinfo.value)


@pytest.mark.django_db
def test_complete_gap_job_happy_path(test_setup):
    """✓ complete_gap_job computes gap timer independently and does NOT alter parent total_active_seconds"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    parent = Task.objects.create(
        title="Suspended Parent",
        status=Task.Status.SUSPENDED,
        company=company,
        assigned_to=worker,
        total_active_seconds=500
    )
    
    gap = Task.objects.create(
        title="Gap Job",
        status=Task.Status.IN_PROGRESS,
        company=company,
        assigned_to=worker,
        started_at=timezone.now() - timezone.timedelta(seconds=600),
        estimated_hours=0.50
    )
    parent.gap_job = gap
    parent.save()

    with patch('tasks.services.gap_job_service.notify_worker_resume_ready') as mock_notify:
        completed_gap = gap_job_service.complete_gap_job(gap.id, worker)
        
        # Verify billing computation
        assert completed_gap.status == Task.Status.COMPLETED
        assert completed_gap.billed_hours == 0.50 # 1200s = 20m <= 45m with < 1hr est
        
        # Verify parent was untouched
        parent.refresh_from_db()
        assert parent.total_active_seconds == 500
        
        # Verify placeholder notification was executed
        mock_notify.assert_called_once_with(worker, parent)


@pytest.mark.django_db
def test_resume_job_happy_path(test_setup):
    """✓ resume_job restores InProgress and clears suspension fields"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    gap = Task.objects.create(title="Gap", status=Task.Status.COMPLETED, company=company, assigned_to=worker)
    task = Task.objects.create(
        title="Suspended Task",
        status=Task.Status.SUSPENDED,
        company=company,
        assigned_to=worker,
        suspended_at=timezone.now(),
        gap_job=gap,
        location_lat=12.0,
        location_lon=80.0,
        geofence_radius=500
    )

    res = gap_job_service.resume_job(task.id, worker, current_lat=12.001, current_lng=80.001)

    res_task = res["task"]
    assert res_task.status == Task.Status.IN_PROGRESS
    assert res_task.suspended_at is None
    assert res_task.gap_job is None
    assert res["overdue_warning"] is False
    assert res_task.time_log is not None


@pytest.mark.django_db
def test_resume_job_proximity_violation(test_setup):
    """✓ resume_job with GPS too far → ProximityError"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    task = Task.objects.create(
        title="Suspended Task",
        status=Task.Status.SUSPENDED,
        company=company,
        assigned_to=worker,
        location_lat=12.0,
        location_lon=80.0,
        geofence_radius=500
    )

    # 12.5, 80.5 is far (> 500 meters)
    with pytest.raises(ProximityError) as excinfo:
        gap_job_service.resume_job(task.id, worker, current_lat=12.5, current_lng=80.5)
    
    assert "from the job site. Move closer to resume" in str(excinfo.value)


@pytest.mark.django_db
def test_resume_job_overdue_warning(test_setup):
    """✓ resume_job after resume_deadline → succeeds + overdue_warning=True"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    task = Task.objects.create(
        title="Suspended Task",
        status=Task.Status.SUSPENDED,
        company=company,
        assigned_to=worker,
        resume_deadline=timezone.now() - timezone.timedelta(minutes=10)
    )

    res = gap_job_service.resume_job(task.id, worker, current_lat=12.0, current_lng=80.0)
    
    assert res["overdue_warning"] is True
    assert res["task"].status == Task.Status.IN_PROGRESS


@pytest.mark.django_db
def test_chained_gap_jobs(test_setup):
    """✓ chained gap jobs: suspend Job1 → Gap1 done → suspend Job1 again → accept Gap2"""
    worker = test_setup["worker1"]
    company = test_setup["company1"]
    
    parent = Task.objects.create(
        title="Main Parent",
        status=Task.Status.IN_PROGRESS,
        company=company,
        assigned_to=worker,
        started_at=timezone.now() - timezone.timedelta(seconds=60)
    )

    gap1 = Task.objects.create(title="Gap One", status=Task.Status.PENDING, company=company, assigned_to=test_setup["admin1"])
    gap2 = Task.objects.create(title="Gap Two", status=Task.Status.PENDING, company=company, assigned_to=test_setup["admin1"])

    # 1. Suspend parent first time
    parent = gap_job_service.suspend_job(parent.id, worker)
    assert parent.total_active_seconds >= 60

    # 2. Accept Gap 1
    parent, gap1 = gap_job_service.accept_gap_job(gap1.id, worker, parent.id)
    assert parent.gap_job_id == gap1.id

    # 3. Complete Gap 1
    gap_job_service.complete_gap_job(gap1.id, worker)

    # 4. Resume parent
    res = gap_job_service.resume_job(parent.id, worker, current_lat=0, current_lng=0)
    parent = res["task"]
    assert parent.gap_job is None
    
    # Simulate work
    parent.started_at = timezone.now() - timezone.timedelta(seconds=120)
    parent.save()

    # 5. Suspend parent second time
    parent = gap_job_service.suspend_job(parent.id, worker)
    assert parent.total_active_seconds >= 180

    # 6. Accept Gap 2
    parent, gap2 = gap_job_service.accept_gap_job(gap2.id, worker, parent.id)
    assert parent.gap_job_id == gap2.id


@pytest.mark.django_db
def test_tenant_isolation(test_setup):
    """✓ tenant isolation: worker cannot suspend another tenant's task"""
    worker_c2 = test_setup["worker2"] # Company 2
    company1 = test_setup["company1"] # Company 1
    
    # Task in Company 1
    task = Task.objects.create(
        title="Company 1 Task",
        status=Task.Status.IN_PROGRESS,
        company=company1,
        assigned_to=test_setup["worker1"]
    )

    # Company 2 worker tries to suspend Company 1 task
    with pytest.raises(ValidationError) as excinfo:
        gap_job_service.suspend_job(task.id, worker_c2)
        
    assert "Task not found or not assigned to you." in str(excinfo.value)
