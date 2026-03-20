EM focus area validation workflow

1. Export a labeling file:
   `python manage.py export_em_validation_dataset --limit 120`
2. Fill `actual_primary` and optionally `actual_secondary`.
3. Evaluate:
   `python manage.py evaluate_em_focus_area --input backend/validation/em_focus_area_validation.csv`

Notes
- The export command creates a 100-150 row style manual labeling sheet.
- This repo now includes the workflow, but the actual manual labels still need to be filled by review.
