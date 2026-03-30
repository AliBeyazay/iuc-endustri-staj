from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('listings', '0008_listing_canonical_listing'),
    ]

    operations = [
        migrations.AddField(
            model_name='listing',
            name='moderated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='listing',
            name='moderation_note',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='listing',
            name='moderation_status',
            field=models.CharField(
                choices=[('approved', 'Onaylandi'), ('rejected', 'Reddedildi'), ('pending', 'Beklemede')],
                db_index=True,
                default='approved',
                max_length=10,
            ),
        ),
    ]
