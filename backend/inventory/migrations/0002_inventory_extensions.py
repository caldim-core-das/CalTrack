# Generated for InventoryItem extension fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="inventoryitem",
            name="reserved_quantity",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="inventoryitem",
            name="reorder_quantity",
            field=models.PositiveIntegerField(default=10),
        ),
        migrations.AddField(
            model_name="inventoryitem",
            name="pending_purchase_quantity",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="inventoryitem",
            name="expected_delivery_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
