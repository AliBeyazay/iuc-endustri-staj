"""Mark all unverified students as verified."""
from django.core.management.base import BaseCommand

from apps.listings.models import Student


class Command(BaseCommand):
    help = "Set is_verified=True for all unverified student accounts."

    def handle(self, *args, **options):
        count = Student.objects.filter(is_verified=False).update(is_verified=True)
        self.stdout.write(self.style.SUCCESS(f"Verified {count} student(s)."))
