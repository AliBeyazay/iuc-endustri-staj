from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0004_add_notification_preferences'),
    ]

    operations = [
        migrations.CreateModel(
            name='Application',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('basvurdum', 'Basvurdum'), ('mulakat', 'Mulakat'), ('kabul', 'Kabul'), ('ret', 'Ret')], default='basvurdum', max_length=12)),
                ('applied_at', models.DateTimeField(auto_now_add=True)),
                ('notes', models.TextField(blank=True, default='')),
                ('listing', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='applications', to='listings.listing')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='applications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Basvuru',
                'verbose_name_plural': 'Basvurular',
                'ordering': ['-applied_at'],
                'unique_together': {('student', 'listing')},
            },
        ),
    ]

