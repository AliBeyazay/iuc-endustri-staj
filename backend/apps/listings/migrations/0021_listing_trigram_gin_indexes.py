from django.db import migrations


TRIGRAM_INDEXES = (
    ('listings_listing_title_trgm_gin', 'title'),
    ('listings_listing_company_trgm_gin', 'company_name'),
    ('listings_listing_location_trgm_gin', 'location'),
    ('listings_listing_requirem_trgm_gin', 'requirements'),
)


def create_trigram_indexes(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    listing_model = apps.get_model('listings', 'Listing')
    table_name = schema_editor.quote_name(listing_model._meta.db_table)

    for index_name, field_name in TRIGRAM_INDEXES:
        column_name = schema_editor.quote_name(listing_model._meta.get_field(field_name).column)
        schema_editor.execute(
            f'CREATE INDEX IF NOT EXISTS {schema_editor.quote_name(index_name)} '
            f'ON {table_name} USING gin ({column_name} gin_trgm_ops)'
        )


def drop_trigram_indexes(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    for index_name, _field_name in TRIGRAM_INDEXES:
        schema_editor.execute(f'DROP INDEX IF EXISTS {schema_editor.quote_name(index_name)}')


class Migration(migrations.Migration):
    dependencies = [
        ('listings', '0020_search_log'),
    ]

    operations = [
        migrations.RunPython(create_trigram_indexes, reverse_code=drop_trigram_indexes),
    ]
