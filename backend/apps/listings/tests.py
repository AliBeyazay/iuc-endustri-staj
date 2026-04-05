from django.core.cache import cache
from django.test import TestCase

from apps.listings.cache_keys import get_listing_list_cache_version
from apps.listings.models import Listing, SuppressedListingSource
from apps.scraper.pipelines import DjangoORMPipeline


class ListingDeletionProtectionTests(TestCase):
    def setUp(self):
        cache.clear()

    def create_listing(self, **overrides):
        payload = {
            'title': 'Test Listing',
            'company_name': 'Test Company',
            'source_url': 'https://example.com/listing/test-listing',
            'application_url': 'https://example.com/apply/test-listing',
            'source_platform': 'youthall',
            'location': 'Istanbul',
            'description': 'Test description',
        }
        payload.update(overrides)
        return Listing.objects.create(**payload)

    def test_deleting_listing_creates_suppressed_source_record(self):
        listing = self.create_listing()

        listing.delete()

        suppressed = SuppressedListingSource.objects.get(source_url=listing.source_url)
        self.assertEqual(suppressed.source_platform, 'youthall')
        self.assertEqual(suppressed.listing_title, 'Test Listing')
        self.assertEqual(suppressed.company_name, 'Test Company')
        self.assertEqual(suppressed.suppressed_reason, 'manual_delete')

    def test_listing_cache_version_bumps_after_create_and_delete(self):
        initial_version = get_listing_list_cache_version()

        listing = self.create_listing()
        after_create_version = get_listing_list_cache_version()
        listing.delete()
        after_delete_version = get_listing_list_cache_version()

        self.assertGreater(after_create_version, initial_version)
        self.assertGreater(after_delete_version, after_create_version)


class DummyLogger:
    def __init__(self):
        self.messages = []

    def info(self, message, *args):
        self.messages.append(('info', message % args if args else message))

    def warning(self, message, *args):
        self.messages.append(('warning', message % args if args else message))


class DummySpider:
    def __init__(self):
        self.logger = DummyLogger()

    def get_sector_classification(self, title, description, company_name, source_platform):
        return {
            'primary': 'diger',
            'secondary': None,
            'confidence': 0,
        }


class DjangoORMPipelineTests(TestCase):
    def test_skips_recreating_suppressed_listing_source(self):
        SuppressedListingSource.objects.create(
            source_url='https://example.com/listing/test-listing',
            source_platform='youthall',
            listing_title='Deleted Listing',
            company_name='Deleted Company',
        )
        pipeline = DjangoORMPipeline()
        spider = DummySpider()

        pipeline.process_item(
            {
                'title': 'Deleted Listing',
                'company_name': 'Deleted Company',
                'source_url': 'https://example.com/listing/test-listing',
                'application_url': 'https://example.com/apply/test-listing',
                'source_platform': 'youthall',
                'location': 'Istanbul',
                'description': 'Should not be recreated',
            },
            spider,
        )

        self.assertFalse(Listing.objects.filter(source_url='https://example.com/listing/test-listing').exists())
        self.assertIn(
            (
                'info',
                'SUPPRESSED_SOURCE_SKIPPED: https://example.com/listing/test-listing',
            ),
            spider.logger.messages,
        )
