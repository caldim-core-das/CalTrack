from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, IntervalSchedule
import json


class Command(BaseCommand):
    help = "Register trial management periodic tasks in Celery Beat"

    def handle(self, *args, **kwargs):
        every_30min, _ = IntervalSchedule.objects.get_or_create(
            every=30, period=IntervalSchedule.MINUTES
        )
        every_hour, _ = IntervalSchedule.objects.get_or_create(
            every=1, period=IntervalSchedule.HOURS
        )
        PeriodicTask.objects.update_or_create(
            name="Trial: Check Reminders",
            defaults={
                "task": "trial_management.check_trial_reminders",
                "interval": every_30min,
                "args": json.dumps([]),
            }
        )
        PeriodicTask.objects.update_or_create(
            name="Trial: Process Expirations",
            defaults={
                "task": "trial_management.process_trial_expirations",
                "interval": every_hour,
                "args": json.dumps([]),
            }
        )
        self.stdout.write(self.style.SUCCESS("Trial tasks registered."))
