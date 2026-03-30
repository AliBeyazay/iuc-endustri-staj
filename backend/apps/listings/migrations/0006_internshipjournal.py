from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0005_application'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='InternshipJournal',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=160)),
                ('content', models.TextField()),
                ('internship_year', models.IntegerField()),
                ('is_anonymous', models.BooleanField(default=True)),
                ('likes_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('listing', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='internship_journals', to='listings.listing')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='internship_journals', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Staj Gunlugu',
                'verbose_name_plural': 'Staj Gunlukleri',
                'ordering': ['-created_at'],
            },
        ),
    ]
