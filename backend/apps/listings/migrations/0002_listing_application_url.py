from django.db import migrations, models


def backfill_application_url(apps, schema_editor):
    Listing = apps.get_model('listings', 'Listing')
    for listing in Listing.objects.all().only('id', 'source_url', 'application_url'):
        if not listing.application_url:
            listing.application_url = listing.source_url
            listing.save(update_fields=['application_url'])


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='listing',
            name='application_url',
            field=models.URLField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_application_url, migrations.RunPython.noop),
    ]
