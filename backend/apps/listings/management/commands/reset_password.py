"""Reset password for a user by email (reads from env or CLI arg)."""
import os

from django.core.management.base import BaseCommand

from apps.listings.models import Student


class Command(BaseCommand):
    help = "Reset a user's password and ensure the account is verified."

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, default='')
        parser.add_argument('--password', type=str, default='')

    def handle(self, *args, **options):
        email = (options['email'] or os.environ.get('ADMIN_EMAIL', '')).strip().lower()
        password = (options['password'] or os.environ.get('ADMIN_PASSWORD', '')).strip()

        if not email or not password:
            self.stderr.write('Usage: --email <email> --password <pw>  (or set ADMIN_EMAIL/ADMIN_PASSWORD)')
            return

        try:
            user = Student.objects.get(iuc_email=email)
        except Student.DoesNotExist:
            self.stderr.write(self.style.ERROR(f'User not found: {email}'))
            return

        user.set_password(password)
        user.is_verified = True
        user.is_active = True
        user.save(update_fields=['password', 'is_verified', 'is_active'])
        self.stdout.write(self.style.SUCCESS(f'Password reset + verified: {email}'))
