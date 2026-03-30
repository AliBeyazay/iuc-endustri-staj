from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('listings', '0007_journalcomment'),
    ]

    operations = [
        migrations.AddField(
            model_name='listing',
            name='canonical_listing',
            field=models.ForeignKey(
                blank=True,
                db_index=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='duplicate_listings',
                to='listings.listing',
            ),
        ),
    ]
