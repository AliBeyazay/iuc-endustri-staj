from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0006_internshipjournal'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='JournalComment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('content', models.TextField()),
                ('is_anonymous', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('journal', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='listings.internshipjournal')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='journal_comments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Staj Gunlugu Yorumu',
                'verbose_name_plural': 'Staj Gunlugu Yorumlari',
                'ordering': ['created_at'],
            },
        ),
    ]
