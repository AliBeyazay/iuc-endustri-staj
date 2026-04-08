from django.core.management import call_command
from django.core.management.base import BaseCommand


CLEANUP_RULES = (
    {"title": "Ziraat Mühendisi Stajyeri"},
    {"title": "Santiye Sefi"},
    {"id": "4cf867e0-78a5-4f5c-a440-ee8b2ae706ba"},
    {"id": "24d323c8-ad8c-49d9-af8b-1aec1a54f487"},
)


class Command(BaseCommand):
    help = "Apply manual production listing cleanup rules before exporting fixtures."

    def handle(self, *args, **options):
        self.stdout.write("Applying production listing cleanup rules...")

        for rule in CLEANUP_RULES:
            call_command("delete_listing", stdout=self.stdout, **rule)

        self.stdout.write(self.style.SUCCESS("Production listing cleanup finished."))
