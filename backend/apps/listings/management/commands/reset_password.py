"""Reset password for a user by email (reads from env or CLI arg)."""
import os

from django.core.management.base import BaseCommand

from apps.listings.models import Student


class Command(BaseCommand):
    help = "Reset a user's password and ensure the account is verified."

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, default='')
        parser.add_argument('--password', type=str, default='')

    def _reset(self, email, password):
        if not email or not password:
            return
        try:
            user = Student.objects.get(iuc_email=email)
        except Student.DoesNotExist:
            self.stderr.write(self.style.WARNING(f'User not found: {email}'))
            return
        user.set_password(password)
        user.is_verified = True
        user.is_active = True
        user.save(update_fields=['password', 'is_verified', 'is_active'])
        self.stdout.write(self.style.SUCCESS(f'Password reset + verified: {email}'))

    def handle(self, *args, **options):
        cli_email = (options['email'] or '').strip().lower()
        cli_password = (options['password'] or '').strip()

        if cli_email and cli_password:
            self._reset(cli_email, cli_password)
            return

        # Reset admin account
        admin_email = os.environ.get('ADMIN_EMAIL', '').strip().lower()
        admin_password = os.environ.get('ADMIN_PASSWORD', '').strip()
        self._reset(admin_email, admin_password)

        # Reset student account (ensure it is NOT staff/superuser)
        student_email = os.environ.get('STUDENT_EMAIL', '').strip().lower()
        student_password = os.environ.get('STUDENT_PASSWORD', '').strip()
        self._reset(student_email, student_password)
        if student_email:
            try:
                stu = Student.objects.get(iuc_email=student_email)
                changed = False
                if stu.is_staff or stu.is_superuser:
                    stu.is_staff = False
                    stu.is_superuser = False
                    changed = True
                if stu.first_name == 'Admin':
                    stu.first_name = student_email.split('@')[0].split('.')[0].title()
                    stu.last_name = student_email.split('@')[0].split('.')[-1].title() if '.' in student_email.split('@')[0] else ''
                    changed = True
                if changed:
                    stu.save(update_fields=['is_staff', 'is_superuser', 'first_name', 'last_name'])
                    self.stdout.write(self.style.SUCCESS(
                        f'Fixed student account: {student_email} → '
                        f'is_staff={stu.is_staff}, name={stu.first_name} {stu.last_name}'
                    ))
            except Student.DoesNotExist:
                pass
