import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Evaluates EM sector predictions against a manually labeled CSV dataset.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--input',
            type=str,
            default='backend/validation/em_focus_area_validation.csv',
        )

    def handle(self, *args, **options):
        input_path = Path(options['input'])
        if not input_path.exists():
            raise CommandError(f'File not found: {input_path}')

        total = 0
        primary_correct = 0
        secondary_hits = 0
        low_confidence = 0

        with input_path.open('r', newline='', encoding='utf-8') as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                actual_primary = (row.get('actual_primary') or '').strip()
                if not actual_primary:
                    continue

                total += 1
                predicted_primary = (row.get('predicted_primary') or '').strip()
                predicted_secondary = (row.get('predicted_secondary') or '').strip()

                try:
                    confidence = float((row.get('predicted_confidence') or '0').strip() or 0)
                except ValueError:
                    confidence = 0

                if confidence < 35:
                    low_confidence += 1

                if predicted_primary == actual_primary:
                    primary_correct += 1
                elif predicted_secondary == actual_primary:
                    secondary_hits += 1

        if total == 0:
            raise CommandError('No manually labeled rows found. Fill actual_primary first.')

        primary_accuracy = round((primary_correct / total) * 100, 2)
        coverage_with_secondary = round(((primary_correct + secondary_hits) / total) * 100, 2)

        self.stdout.write(f'Total labeled rows: {total}')
        self.stdout.write(f'Primary accuracy: {primary_accuracy}%')
        self.stdout.write(f'Primary+secondary coverage: {coverage_with_secondary}%')
        self.stdout.write(f'Low-confidence predictions (<35): {low_confidence}')
