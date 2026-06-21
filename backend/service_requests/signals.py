"""
service_requests/signals.py

Post-save signal on ServiceFeedback:
  → Recalculates EmployeePerformance aggregates whenever feedback is submitted.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Avg, Count, Q


@receiver(post_save, sender="service_requests.ServiceFeedback")
def update_employee_performance(sender, instance, **kwargs):
    """Recalculate EmployeePerformance for the employee linked to this feedback."""
    if not instance.is_submitted:
        return  # Only aggregate after actual submission

    from .models import EmployeeJob, EmployeePerformance, ServiceFeedback

    try:
        job = instance.service_request.employee_job
    except Exception:
        return  # No job linked — skip

    employee = job.employee

    # Aggregate all feedback for this employee
    submitted_feedback = ServiceFeedback.objects.filter(
        is_submitted=True,
        service_request__employee_job__employee=employee,
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
    completion_rate = (completed_count / total_assigned * 100) if total_assigned else 0

    # Customer satisfaction: percentage of resolved issues (0-5 scaled)
    satisfaction = (resolved_count / feedback_count * 5) if feedback_count else 0

    EmployeePerformance.objects.update_or_create(
        employee=employee,
        defaults={
            "jobs_completed_count":        completed_count,
            "average_rating":              round(avg_rating, 2),
            "feedback_count":              feedback_count,
            "completion_rate":             round(completion_rate, 2),
            "customer_satisfaction_score": round(satisfaction, 2),
        },
    )
