from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Enable pg_trgm extension for fuzzy/typo-tolerant search."""

    dependencies = [
        ('listings', '0018_listing_average_rating_listing_bookmark_count'),
    ]

    operations = [
        TrigramExtension(),
    ]
