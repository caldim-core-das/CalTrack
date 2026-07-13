from celery import shared_task
from django.utils import timezone
from .models import TrialPlan
from .services import send_reminder, expire_trial
import logging

logger = logging.getLogger("trial_management")


@shared_task(name="trial_management.check_trial_reminders", bind=True, max_retries=3)
def check_trial_reminders(self):
    """
    Runs every 30 minutes via Celery Beat.
    Sends reminder emails at 10d, 5d, 3d, 1d milestones.
    Never sends the same reminder twice (idempotent flag guards).
    """
    now = timezone.now()
    active_trials = TrialPlan.objects.filter(status=TrialPlan.Status.ACTIVE)

    for trial in active_trials:
        days_left = trial.days_remaining
        try:
            if days_left <= 10 and not trial.reminder_10d_sent:
                send_reminder(trial, "10d")
            if days_left <= 5 and not trial.reminder_5d_sent:
                send_reminder(trial, "5d")
            if days_left <= 3 and not trial.reminder_3d_sent:
                send_reminder(trial, "3d")
            if days_left <= 1 and not trial.reminder_1d_sent:
                send_reminder(trial, "1d")
        except Exception as e:
            logger.error(f"Error sending reminder for trial {trial.id}: {e}")


@shared_task(name="trial_management.process_trial_expirations", bind=True, max_retries=3)
def process_trial_expirations(self):
    """
    Runs every hour via Celery Beat.
    Marks expired trials and sends the expiry email.
    """
    now = timezone.now()
    overdue = TrialPlan.objects.filter(
        status=TrialPlan.Status.ACTIVE,
        trial_end__lte=now
    )
    for trial in overdue:
        try:
            expire_trial(trial)
        except Exception as e:
            logger.error(f"Error expiring trial {trial.id}: {e}")
