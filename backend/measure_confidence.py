from apps.listings.models import Listing
from django.db.models import Count

qs = Listing.objects.filter(is_active=True, canonical_listing__isnull=True)
total = qs.count()
diger = qs.filter(em_focus_area='diger').count()
conf_zero = qs.filter(em_focus_area='diger', em_focus_confidence=0).count()
conf_pos = qs.filter(em_focus_area='diger', em_focus_confidence__gt=0).count()

print(f"Toplam: {total}, Diger: {diger} ({diger/total*100:.1f}%)")
print(f"  conf=0 (hic signal yok): {conf_zero}")
print(f"  conf>0 (signal var ama diger): {conf_pos}")
print()

# Confidence distribution of NON-diger (correctly classified) listings
non_diger = qs.exclude(em_focus_area='diger')
print(f"Siniflandirilmis {non_diger.count()} ilanin confidence dagilimi:")
buckets = [
    ('0%',   0, 0),
    ('1-24%',   1, 24),
    ('25-49%',  25, 49),
    ('50-74%',  50, 74),
    ('75-99%',  75, 99),
    ('100%', 100, 100),
]
for label, lo, hi in buckets:
    n = non_diger.filter(em_focus_confidence__gte=lo, em_focus_confidence__lte=hi).count()
    pct = n / non_diger.count() * 100
    bar = '#' * int(pct / 3)
    print(f"  {label:<8} {n:4d}  {pct:5.1f}%  {bar}")

print()
# What % would have been diger under the OLD threshold (conf < 35)?
would_be_diger_old = non_diger.filter(em_focus_confidence__lt=35).count()
print(f"Eski esik (conf<35) ile diger'e dusecek ilan sayisi: {would_be_diger_old} ({would_be_diger_old/non_diger.count()*100:.1f}%)")
would_be_diger_25 = non_diger.filter(em_focus_confidence__lt=25).count()
print(f"Orta esik (conf<25) ile diger'e dusecek ilan sayisi: {would_be_diger_25} ({would_be_diger_25/non_diger.count()*100:.1f}%)")
