"""
service_requests/signals.py

Post-save signal on ServiceFeedback:
  → Recalculates EmployeePerformance aggregates whenever feedback is submitted.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Avg, Count, Q


def recalculate_employee_performance(employee):
    """Calculate and save EmployeePerformance aggregates for an employee."""
    from .models import EmployeeJob, EmployeePerformance, ServiceFeedback, ServiceRequest
    from tasks.models import Task
    from django.db.models import Avg, Count, Q

    # Aggregate all feedback for this employee
    submitted_feedback = ServiceFeedback.objects.filter(
        is_submitted=True
    ).filter(
        Q(service_request__assigned_employee=employee) |
        Q(service_request__employee_job__employee=employee)
    )

    agg = submitted_feedback.aggregate(
        avg_rating=Avg("rating"),
        count=Count("id"),
        resolved_count=Count("id", filter=Q(issue_resolved=True)),
    )

    avg_rating      = agg["avg_rating"] or 0
    feedback_count  = agg["count"] or 0
    resolved_count  = agg["resolved_count"] or 0

    # Completion rate: completed jobs / total assigned jobs
    completed_jobs = EmployeeJob.objects.filter(
        employee=employee
    ).filter(
        Q(status=EmployeeJob.Status.COMPLETED) | Q(status__iexact="completed")
    ).count()
    total_jobs = EmployeeJob.objects.filter(employee=employee).count()

    # Fallback/merge with direct service request assignments
    sr_assigned = ServiceRequest.objects.filter(
        Q(assigned_employee=employee) | Q(employee_job__employee=employee)
    )
    sr_total = sr_assigned.count()
    sr_completed = sr_assigned.filter(
        status__in=[
            "completed", "awaiting_verification", "verified",
            "feedback_pending", "feedback_received", "closed"
        ]
    ).count()

    # Operational Task models
    user = getattr(employee, "user", None)
    task_total = 0
    task_completed = 0
    if user:
        task_qs = Task.objects.filter(Q(assigned_to=user) | Q(assigned_to_id=user.id))
        task_total = task_qs.count()
        task_completed = task_qs.filter(
            Q(status__iexact="completed") | Q(travel_status__iexact="done") | Q(completed_at__isnull=False)
        ).count()

    # Take maximum completed and assigned count across all system sources
    completed_count = max(completed_jobs, sr_completed, task_completed)
    total_assigned = max(total_jobs, sr_total, task_total)

    completion_rate = (completed_count / total_assigned * 100) if total_assigned > 0 else (100.0 if completed_count > 0 else 0.0)
    satisfaction = (resolved_count / feedback_count * 5) if feedback_count > 0 else (avg_rating if avg_rating > 0 else (5.0 if completed_count > 0 else 0.0))

    perf, _ = EmployeePerformance.objects.update_or_create(
        employee=employee,
        defaults={
            "jobs_completed_count":        completed_count,
            "average_rating":              round(avg_rating, 2),
            "feedback_count":              feedback_count,
            "completion_rate":             round(completion_rate, 2),
            "customer_satisfaction_score": round(satisfaction, 2),
        },
    )
    return perf


@receiver(post_save, sender="service_requests.ServiceFeedback")
def update_employee_performance(sender, instance, **kwargs):
    """Recalculate EmployeePerformance for the employee linked to this feedback."""
    if not instance.is_submitted:
        return  # Only aggregate after actual submission

    sr = instance.service_request
    employee = sr.assigned_employee
    if not employee:
        try:
            employee = sr.employee_job.employee
        except Exception:
            pass

    if not employee:
        return  # No employee linked — skip

    recalculate_employee_performance(employee)
