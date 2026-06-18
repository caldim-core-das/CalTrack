from django.db.models.signals import post_save
from django.dispatch import receiver
from companies.models import Company


@receiver(post_save, sender=Company)
def auto_activate_trial(sender, instance, created, **kwargs):
    if created:
        if getattr(instance, '_skip_trial_activation', False):
            from trial_management.models import TrialPlan
            TrialPlan.objects.get_or_create(
                company=instance,
                defaults={
                    "status": TrialPlan.Status.NOT_STARTED,
                    "trial_type": "14-day"
                }
            )
            return

        from trial_management.services import activate_trial
        try:
            activate_trial(instance)
        except Exception as e:
            import logging
            logging.getLogger("trial_management").warning(
                f"Failed to activate trial for company {instance.id}: {e}"
            )
