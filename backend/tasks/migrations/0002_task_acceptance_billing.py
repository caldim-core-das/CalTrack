from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Accept / Decline workflow ─────────────────────────────────────
        migrations.AddField(
            model_name='task',
            name='acceptance_status',
            field=models.CharField(
                choices=[
                    ('pending_acceptance', 'Pending Acceptance'),
                    ('accepted', 'Accepted'),
                    ('declined', 'Declined'),
                ],
                default='pending_acceptance',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='task',
            name='decline_reason',
            field=models.TextField(blank=True, default=''),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='task',
            name='declined_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='task',
            name='declined_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='declined_tasks',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # ── Billed hours ──────────────────────────────────────────────────
        migrations.AddField(
            model_name='task',
            name='billed_hours',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=5,
                null=True,
            ),
        ),
    ]
