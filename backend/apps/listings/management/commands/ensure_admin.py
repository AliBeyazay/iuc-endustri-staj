"""
Create or update a superuser from environment variables.

Required env vars:
  ADMIN_EMAIL    – e.g. admin@iuc.edu.tr
  ADMIN_PASSWORD – strong password

Idempotent: safe to run on every deploy.
"""

import os

from django.core.management.base import BaseCommand

from apps.listings.models import Student


class Command(BaseCommand):
    help = 'Ensure a superuser exists (reads ADMIN_EMAIL / ADMIN_PASSWORD env vars)'

    def handle(self, *_args, **_options):
        email = os.environ.get('ADMIN_EMAIL', '').strip()
        password = os.environ.get('ADMIN_PASSWORD', '').strip()

        if not email or not password:
            self.stdout.write('ADMIN_EMAIL / ADMIN_PASSWORD not set – skipping.')
            return

        user, created = Student.objects.get_or_create(
            iuc_email=email,
            defaults={
                'username': email.split('@')[0],
                'first_name': 'Admin',
                'last_name': '',
                'is_staff': True,
                'is_superuser': True,
                'is_verified': True,
            },
        )

        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Superuser created: {email}'))
        else:
            # Ensure existing account has staff + superuser flags
            changed = False
            if not user.is_staff:
                user.is_staff = True
                changed = True
            if not user.is_superuser:
                user.is_superuser = True
                changed = True
            if not user.is_verified:
                user.is_verified = True
                changed = True
            if changed:
                user.save()
                self.stdout.write(self.style.SUCCESS(f'Superuser flags updated: {email}'))
            else:
                self.stdout.write(f'Superuser already exists: {email}')
