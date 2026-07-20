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
    total_assigned  = EmployeeJob.objects.filter(employee=employee).count()
    completed_count = EmployeeJob.objects.filter(
        employee=employee,
        status=EmployeeJob.Status.COMPLETED,
    ).count()

    # Fallback/merge with direct service request assignments
    sr_assigned = ServiceRequest.objects.filter(assigned_employee=employee)
    sr_total = sr_assigned.count()

    if sr_total > total_assigned:
        total_assigned = sr_total
        completed_count = sr_assigned.filter(
            status__in=[
                "completed", "awaiting_verification", "verified",
                "feedback_pending", "feedback_received", "closed"
            ]
        ).count()
    # Phase 3 enhancement: The frontend Job Queue uses `Task` models as the operational unit.
    # So we pull true `Task` counts and override if it has more completed jobs or total assigned.
    from tasks.models import Task
    task_total = Task.objects.filter(assigned_to=employee.user).count()
    task_completed = Task.objects.filter(assigned_to=employee.user, status=Task.Status.COMPLETED).count()
    
    # We use the system that reflects the most accurate (highest) completion count
    if task_completed > completed_count or task_total > total_assigned:
        total_assigned = max(task_total, total_assigned)
        completed_count = max(task_completed, completed_count)

    completion_rate = (completed_count / total_assigned * 100) if total_assigned else 0

    # Customer satisfaction: percentage of resolved issues (0-5 scaled)
    satisfaction = (resolved_count / feedback_count * 5) if feedback_count else 0

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
