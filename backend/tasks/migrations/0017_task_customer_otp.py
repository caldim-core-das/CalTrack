from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0016_remove_taskexpense_task_remove_taskproduct_task_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="start_otp",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Customer OTP required before technician starts work.",
                max_length=6,
            ),
        ),
        migrations.AddField(
            model_name="task",
            name="otp_created_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Timestamp when customer OTP was generated.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="task",
            name="is_otp_verified",
            field=models.BooleanField(
                default=False,
                help_text="True when customer OTP has been verified by technician.",
            ),
        ),
    ]
