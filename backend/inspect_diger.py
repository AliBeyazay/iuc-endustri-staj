import django
import os
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.prod"
django.setup()

from apps.listings.models import Listing
from django.db.models import Count

all_qs = Listing.objects.filter(is_active=True, canonical_listing__isnull=True)
qs = all_qs.filter(em_focus_area='diger')
total = all_qs.count()
diger = qs.count()
print(f"Toplam: {total}, Diger: {diger} ({diger/total*100:.1f}%)\n")

print("Confidence dagılımı (diger icinde):")
for row in qs.values('em_focus_confidence').annotate(n=Count('id')).order_by('em_focus_confidence')[:12]:
    print(f"  conf={float(row['em_focus_confidence']):5.1f}% -> {row['n']} ilan")

print("\nPlatform dagılımı (diger icinde):")
for row in qs.values('source_platform').annotate(n=Count('id')).order_by('-n'):
    print(f"  {row['source_platform']}: {row['n']}")

print("\n--- 35 ornek (conf | platform | company | title) ---")
for l in qs.order_by('-em_focus_confidence')[:35]:
    print(f"  [{float(l.em_focus_confidence):5.1f}] {l.source_platform:<10} {l.company_name[:22]:<22} | {l.title[:65]}")
