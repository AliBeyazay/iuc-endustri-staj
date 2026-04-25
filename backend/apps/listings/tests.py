import json
from datetime import date, timedelta
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.contrib.admin.models import DELETION, LogEntry
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.management import call_command
from django.core.management.base import CommandError
from django.http import QueryDict
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from scrapy.exceptions import DropItem
from rest_framework.test import APIClient

from apps.listings.admin import ListingAdmin
from apps.listings.cache_keys import get_listing_list_cache_version
from apps.listings.eligibility import classify_student_eligibility
from apps.listings.models import Bookmark, Listing, Review, SuppressedListingSource
from apps.listings.runtime import get_admin_runtime_info
from apps.listings.sync import delete_listing_groups
from apps.listings.views import ListingViewSet
from apps.scraper.pipelines import DjangoORMPipeline, EligibilityValidationPipeline


class EligibilityHelperTests(SimpleTestCase):
    def test_detects_explicit_graduate_only_signals(self):
        samples = (
            "This position is only open to graduates",
            "Graduates only",
            "Sadece mezun adaylar",
            "Current students will not be considered",
            "Yalnızca yeni mezun adaylar",
        )

        for sample in samples:
            with self.subTest(sample=sample):
                decision = classify_student_eligibility("Sample Listing", sample)
                self.assertTrue(decision.graduate_only)
                self.assertIsNotNone(decision.reason)

    def test_keeps_mixed_student_and_graduate_phrases_visible(self):
        samples = (
            "3rd/4th year students or recent graduates",
            "Undergraduate or master's students, as well as recent graduates",
            "New graduates are welcome",
            "Current Bachelor's or Master's students may apply",
        )

        for sample in samples:
            with self.subTest(sample=sample):
                decision = classify_student_eligibility("Sample Listing", sample)
                self.assertFalse(decision.graduate_only)
                self.assertFalse(decision.requires_experience)

    def test_detects_required_experience_signals(self):
        samples = (
            "Tercihen Savunma Sanayii projelerinde proje yönetimi alanında en az 3 yıl tecrübe sahibi",
            "Tercihen 4-8 yıl deneyimli",
            "Minimum 3 years of professional experience",
            "At least 5 years experience in project management",
            "Minimum of 3 years experience within a similar role",
            "1-3 years working experience in demand roles",
        )

        for sample in samples:
            with self.subTest(sample=sample):
                decision = classify_student_eligibility("Sample Listing", sample)
                self.assertFalse(decision.graduate_only)
                self.assertTrue(decision.requires_experience)
                self.assertIsNotNone(decision.reason)


class ListingDeletionProtectionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api_client = APIClient()

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

    def create_admin_user(self, username='admin-user'):
        return get_user_model().objects.create_superuser(
            username=username,
            iuc_email=f'{username}@iuc.edu.tr',
            email=f'{username}@iuc.edu.tr',
            password='test-pass-123',
        )

    def test_deleting_listing_creates_suppressed_source_record(self):
        listing = self.create_listing()

        listing.delete()

        suppressed = SuppressedListingSource.objects.get(source_url=listing.source_url)
        self.assertEqual(suppressed.source_platform, 'youthall')
        self.assertEqual(suppressed.listing_title, 'Test Listing')
        self.assertEqual(suppressed.company_name, 'Test Company')
        self.assertEqual(suppressed.suppressed_reason, 'manual_delete')

    def test_deleting_canonical_listing_removes_duplicate_group(self):
        canonical = self.create_listing(
            title='Shared Listing',
            company_name='Shared Company',
            source_url='https://example.com/listing/shared-canonical',
        )
        duplicate = self.create_listing(
            title='Shared Listing Copy',
            company_name='Shared Company',
            source_url='https://example.com/listing/shared-duplicate',
            source_platform='anbea',
            canonical_listing=canonical,
        )

        deleted_count = delete_listing_groups(Listing.objects.filter(id=canonical.id))

        self.assertEqual(deleted_count, 2)
        self.assertFalse(Listing.objects.filter(id__in=[canonical.id, duplicate.id]).exists())
        self.assertEqual(
            set(SuppressedListingSource.objects.values_list('source_url', flat=True)),
            {
                'https://example.com/listing/shared-canonical',
                'https://example.com/listing/shared-duplicate',
            },
        )

    def test_deleting_duplicate_listing_removes_canonical_group(self):
        canonical = self.create_listing(
            title='Shared Listing',
            company_name='Shared Company',
            source_url='https://example.com/listing/shared-canonical-2',
        )
        duplicate = self.create_listing(
            title='Shared Listing Copy',
            company_name='Shared Company',
            source_url='https://example.com/listing/shared-duplicate-2',
            source_platform='anbea',
            canonical_listing=canonical,
        )

        deleted_count = delete_listing_groups(Listing.objects.filter(id=duplicate.id))

        self.assertEqual(deleted_count, 2)
        self.assertFalse(Listing.objects.filter(id__in=[canonical.id, duplicate.id]).exists())

    def test_listing_cache_version_bumps_after_create_and_delete(self):
        initial_version = get_listing_list_cache_version()

        listing = self.create_listing()
        after_create_version = get_listing_list_cache_version()
        listing.delete()
        after_delete_version = get_listing_list_cache_version()

        self.assertGreater(after_create_version, initial_version)
        self.assertGreater(after_delete_version, after_create_version)

    def test_delete_listing_groups_bumps_cache_version_when_group_deleted(self):
        canonical = self.create_listing(
            title='Delete Version Canonical',
            source_url='https://example.com/listing/delete-version-canonical',
        )
        self.create_listing(
            title='Delete Version Duplicate',
            source_url='https://example.com/listing/delete-version-duplicate',
            source_platform='anbea',
            canonical_listing=canonical,
        )
        initial_version = get_listing_list_cache_version()

        deleted_count = delete_listing_groups(Listing.objects.filter(id=canonical.id))

        self.assertEqual(deleted_count, 2)
        self.assertGreater(get_listing_list_cache_version(), initial_version)

    def test_delete_listing_groups_without_matches_keeps_cache_version(self):
        initial_version = get_listing_list_cache_version()

        deleted_count = delete_listing_groups(Listing.objects.filter(title='missing-listing'))

        self.assertEqual(deleted_count, 0)
        self.assertEqual(get_listing_list_cache_version(), initial_version)

    def test_featured_update_bumps_cache_version(self):
        listing = self.create_listing()
        initial_version = get_listing_list_cache_version()

        listing.is_homepage_featured = True
        listing.homepage_featured_rank = 1
        listing.save(update_fields=['is_homepage_featured', 'homepage_featured_rank'])

        self.assertGreater(get_listing_list_cache_version(), initial_version)

    def test_admin_deactivate_action_bumps_cache_version(self):
        listing = self.create_listing()
        initial_version = get_listing_list_cache_version()
        request = RequestFactory().post('/admin/listings/listing/')
        model_admin = ListingAdmin(Listing, AdminSite())
        model_admin.message_user = lambda *args, **kwargs: None

        model_admin.deactivate_listings(request, Listing.objects.filter(id=listing.id))

        listing.refresh_from_db()
        self.assertFalse(listing.is_active)
        self.assertGreater(get_listing_list_cache_version(), initial_version)

    def test_admin_moderation_approve_restores_visibility_and_bumps_cache_version(self):
        listing = self.create_listing(
            title='Pending Approval Listing',
            source_url='https://example.com/listing/pending-approval-listing',
            is_active=False,
            moderation_status='pending',
        )
        admin_user = self.create_admin_user('approve-admin')
        initial_version = get_listing_list_cache_version()

        before_response = self.client.get('/api/listings/?limit=50')
        self.assertEqual(before_response.status_code, 200)
        self.assertNotIn(listing.title, [item['title'] for item in before_response.json()['results']])

        self.api_client.force_authenticate(user=admin_user)
        response = self.api_client.patch(
            f'/api/dashboard/admin/listings/{listing.id}/',
            data=json.dumps({'action': 'approve', 'moderation_note': 'Looks good'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        listing.refresh_from_db()
        self.assertEqual(listing.moderation_status, 'approved')
        self.assertTrue(listing.is_active)
        self.assertEqual(listing.moderation_note, 'Looks good')
        self.assertGreater(get_listing_list_cache_version(), initial_version)

        after_response = self.client.get('/api/listings/?limit=50')
        self.assertEqual(after_response.status_code, 200)
        self.assertIn(listing.title, [item['title'] for item in after_response.json()['results']])

    def test_admin_moderation_reject_invalidates_cached_list_and_detail(self):
        listing = self.create_listing(
            title='Rejectable Listing',
            source_url='https://example.com/listing/rejectable-listing',
        )
        admin_user = self.create_admin_user('reject-admin')
        initial_list_response = self.client.get('/api/listings/?limit=50')

        self.assertEqual(initial_list_response.status_code, 200)
        self.assertIn(listing.title, [item['title'] for item in initial_list_response.json()['results']])
        initial_version = get_listing_list_cache_version()

        self.api_client.force_authenticate(user=admin_user)
        response = self.api_client.patch(
            f'/api/dashboard/admin/listings/{listing.id}/',
            data=json.dumps({'action': 'reject', 'moderation_note': 'No longer public'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        listing.refresh_from_db()
        self.assertEqual(listing.moderation_status, 'rejected')
        self.assertFalse(listing.is_active)
        self.assertGreater(get_listing_list_cache_version(), initial_version)

        updated_list_response = self.client.get('/api/listings/?limit=50')
        self.assertEqual(updated_list_response.status_code, 200)
        self.assertNotIn(listing.title, [item['title'] for item in updated_list_response.json()['results']])

        detail_response = self.client.get(f'/api/listings/{listing.id}/')
        self.assertEqual(detail_response.status_code, 404)

    def test_admin_serializer_is_active_update_bumps_cache_version(self):
        listing = self.create_listing(
            title='Serializer Visibility Listing',
            source_url='https://example.com/listing/serializer-visibility-listing',
        )
        admin_user = self.create_admin_user('serializer-active-admin')
        initial_version = get_listing_list_cache_version()

        self.api_client.force_authenticate(user=admin_user)
        response = self.api_client.patch(
            f'/api/dashboard/admin/listings/{listing.id}/',
            data=json.dumps({'is_active': False}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        listing.refresh_from_db()
        self.assertFalse(listing.is_active)
        self.assertGreater(get_listing_list_cache_version(), initial_version)

    def test_admin_serializer_moderation_note_update_keeps_cache_version(self):
        listing = self.create_listing(
            title='Moderation Note Listing',
            source_url='https://example.com/listing/moderation-note-listing',
        )
        admin_user = self.create_admin_user('note-admin')
        initial_version = get_listing_list_cache_version()

        self.api_client.force_authenticate(user=admin_user)
        response = self.api_client.patch(
            f'/api/dashboard/admin/listings/{listing.id}/',
            data=json.dumps({'moderation_note': 'Reviewed manually'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        listing.refresh_from_db()
        self.assertEqual(listing.moderation_note, 'Reviewed manually')
        self.assertEqual(get_listing_list_cache_version(), initial_version)

    @override_settings(ENVIRONMENT='dev', FRONTEND_URL='http://localhost:3000')
    def test_admin_index_shows_runtime_banner(self):
        admin_user = self.create_admin_user('admin')
        self.client.force_login(admin_user)

        response = self.client.get('/admin/')

        self.assertContains(response, 'Environment')
        self.assertContains(response, 'DEV')
        self.assertContains(response, 'Database')
        self.assertContains(response, 'Frontend')
        self.assertContains(response, 'http://localhost:3000')
        self.assertContains(response, 'Backend')
        self.assertContains(response, 'http://testserver')

    @override_settings(ENVIRONMENT='prod', FRONTEND_URL='https://iuc-endustri-staj.vercel.app')
    def test_runtime_info_prefers_explicit_environment_setting(self):
        runtime_info = get_admin_runtime_info()

        self.assertEqual(runtime_info['environment'], 'prod')
        self.assertEqual(runtime_info['frontend_url'], 'https://iuc-endustri-staj.vercel.app')

    def test_listing_api_hides_entries_with_admin_delete_log(self):
        listing = self.create_listing(title='Deleted Via Admin Log', company_name='Test Company')
        admin_user = self.create_admin_user('admin-log')
        LogEntry.objects.create(
            user=admin_user,
            content_type=ContentType.objects.get_for_model(Listing),
            object_id=str(listing.id),
            object_repr=str(listing),
            action_flag=DELETION,
            change_message='',
        )

        response = self.client.get('/api/listings/?limit=50')

        self.assertEqual(response.status_code, 200)
        results = response.json()['results']
        self.assertNotIn('Deleted Via Admin Log', [item['title'] for item in results])

    def test_listing_api_ignores_legacy_duration_bucket_query_param(self):
        short_listing = self.create_listing(
            title='Short Internship',
            source_url='https://example.com/listing/short-internship',
            duration_weeks=4,
        )
        open_listing = self.create_listing(
            title='Open Internship',
            source_url='https://example.com/listing/open-internship',
            duration_weeks=None,
        )

        response = self.client.get('/api/listings/?duration_bucket=4_weeks&limit=50')

        self.assertEqual(response.status_code, 200)
        titles = [item['title'] for item in response.json()['results']]
        self.assertIn(short_listing.title, titles)
        self.assertIn(open_listing.title, titles)

    def test_homepage_featured_endpoint_filters_and_orders_results(self):
        featured_rank_two = self.create_listing(
            title='Featured Two',
            source_url='https://example.com/listing/featured-two',
            is_homepage_featured=True,
            homepage_featured_rank=2,
            homepage_featured_summary='Second featured summary',
        )
        featured_rank_one = self.create_listing(
            title='Featured One',
            source_url='https://example.com/listing/featured-one',
            is_homepage_featured=True,
            homepage_featured_rank=1,
            homepage_featured_summary='First featured summary',
        )
        self.create_listing(
            title='Featured Inactive',
            source_url='https://example.com/listing/featured-inactive',
            is_homepage_featured=True,
            homepage_featured_rank=0,
            is_active=False,
        )
        canonical = self.create_listing(
            title='Canonical Featured',
            source_url='https://example.com/listing/canonical-featured',
            is_homepage_featured=True,
            homepage_featured_rank=3,
        )
        self.create_listing(
            title='Duplicate Featured',
            source_url='https://example.com/listing/duplicate-featured',
            is_homepage_featured=True,
            homepage_featured_rank=1,
            canonical_listing=canonical,
        )
        self.create_listing(
            title='Pending Featured',
            source_url='https://example.com/listing/pending-featured',
            is_homepage_featured=True,
            homepage_featured_rank=1,
            moderation_status='pending',
        )

        response = self.client.get('/api/homepage/featured-listings/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual([item['title'] for item in payload], ['Featured One', 'Featured Two', 'Canonical Featured'])
        self.assertEqual(payload[0]['homepage_featured_summary'], 'First featured summary')
        self.assertEqual(payload[1]['homepage_featured_summary'], 'Second featured summary')
        self.assertEqual(payload[2]['homepage_featured_image_url'], None)
        self.assertEqual({item['id'] for item in payload}, {str(featured_rank_one.id), str(featured_rank_two.id), str(canonical.id)})

    def test_homepage_featured_endpoint_updates_after_flag_removed(self):
        listing = self.create_listing(
            title='Temporary Featured',
            source_url='https://example.com/listing/temp-featured',
            is_homepage_featured=True,
            homepage_featured_rank=1,
            description='A' * 220,
        )

        first_response = self.client.get('/api/homepage/featured-listings/')
        listing.is_homepage_featured = False
        listing.save(update_fields=['is_homepage_featured'])
        second_response = self.client.get('/api/homepage/featured-listings/')

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(len(first_response.json()), 1)
        self.assertTrue(first_response.json()[0]['homepage_featured_summary'].endswith('...'))
        self.assertEqual(second_response.json(), [])

    def test_default_listing_ordering_skips_aggregate_annotations(self):
        view = ListingViewSet()
        view.action = 'list'
        view.request = SimpleNamespace(query_params=QueryDict('ordering=-created_at'))

        annotations = view.get_queryset().query.annotations

        self.assertNotIn('bookmark_count', annotations)
        self.assertNotIn('average_rating', annotations)

    def test_popular_and_top_rated_listing_orderings_still_work(self):
        student = get_user_model().objects.create_user(
            username='ordering-user',
            iuc_email='ordering-user@ogr.iuc.edu.tr',
            email='ordering-user@ogr.iuc.edu.tr',
            password='test-pass-123',
        )
        popular_listing = self.create_listing(
            title='Most Bookmarked',
            source_url='https://example.com/listing/most-bookmarked',
        )
        highly_rated_listing = self.create_listing(
            title='Highest Rated',
            source_url='https://example.com/listing/highest-rated',
        )
        neutral_listing = self.create_listing(
            title='Neutral Listing',
            source_url='https://example.com/listing/neutral-listing',
        )

        Bookmark.objects.create(student=student, listing=popular_listing)
        Review.objects.create(
            listing=highly_rated_listing,
            student=student,
            rating=5,
            comment='Great internship experience',
            internship_year=2026,
            is_anonymous=True,
        )

        popular_response = self.client.get('/api/listings/?ordering=-bookmark_count&limit=10')
        top_rated_response = self.client.get('/api/listings/?ordering=-average_rating&limit=10')

        self.assertEqual(popular_response.status_code, 200)
        self.assertEqual(top_rated_response.status_code, 200)
        self.assertEqual(popular_response.json()['results'][0]['title'], 'Most Bookmarked')
        self.assertEqual(top_rated_response.json()['results'][0]['title'], 'Highest Rated')

        # bookmark_count ve average_rating artık denormalize model alanı —
        # runtime annotation olarak eklenmez, doğrudan model üzerinden sıralanır.
        popular_view = ListingViewSet()
        popular_view.action = 'list'
        popular_view.request = SimpleNamespace(query_params=QueryDict('ordering=-bookmark_count'))
        popular_annotations = popular_view.get_queryset().query.annotations

        top_rated_view = ListingViewSet()
        top_rated_view.action = 'list'
        top_rated_view.request = SimpleNamespace(query_params=QueryDict('ordering=-average_rating'))
        top_rated_annotations = top_rated_view.get_queryset().query.annotations

        self.assertNotIn('bookmark_count', popular_annotations)
        self.assertNotIn('average_rating', popular_annotations)
        self.assertNotIn('bookmark_count', top_rated_annotations)
        self.assertNotIn('average_rating', top_rated_annotations)


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


class EligibilityValidationPipelineTests(TestCase):
    def setUp(self):
        self.pipeline = EligibilityValidationPipeline()
        self.orm_pipeline = DjangoORMPipeline()
        self.spider = DummySpider()

    def test_drops_graduate_only_listing_before_db_write(self):
        item = {
            'title': 'Software QA Intern (4-Month Internship Program). This position is only open to graduates.',
            'company_name': 'Meta Smart Factory',
            'source_url': 'https://tr.linkedin.com/jobs/view/software-qa-intern-1',
            'application_url': 'https://tr.linkedin.com/jobs/view/software-qa-intern-1',
            'source_platform': 'linkedin',
            'location': 'Turkiye',
            'description': 'Graduates only. Current students will not be considered.',
        }

        with self.assertRaises(DropItem):
            self.pipeline.process_item(item, self.spider)

        self.assertFalse(Listing.objects.exists())
        self.assertIn(
            (
                'info',
                'INELIGIBLE_FOR_STUDENTS_SKIPPED: Software QA Intern (4-Month Internship Program). This position is only open to graduates. | reason=graduates_only',
            ),
            self.spider.logger.messages,
        )

    def test_drops_experience_required_listing_before_db_write(self):
        item = {
            'title': 'Elektronik Harp Proje Mühendisi',
            'company_name': 'ASELSAN',
            'source_url': 'https://tr.linkedin.com/jobs/view/elektronik-harp-proje-muhendisi-1',
            'application_url': 'https://tr.linkedin.com/jobs/view/elektronik-harp-proje-muhendisi-1',
            'source_platform': 'linkedin',
            'location': 'Ankara, Turkiye',
            'description': 'Tercihen Savunma Sanayii projelerinde proje yönetimi alanında en az 3 yıl tecrübe sahibi.',
        }

        with self.assertRaises(DropItem):
            self.pipeline.process_item(item, self.spider)

        self.assertFalse(Listing.objects.exists())
        self.assertIn(
            (
                'info',
                'INELIGIBLE_FOR_STUDENTS_SKIPPED: Elektronik Harp Proje Mühendisi | reason=minimum_years_experience_tr',
            ),
            self.spider.logger.messages,
        )

    def test_drops_english_experience_required_listing_before_db_write(self):
        item = {
            'title': 'Supply Chain Specialist',
            'company_name': 'Example Company',
            'source_url': 'https://tr.linkedin.com/jobs/view/supply-chain-specialist-1',
            'application_url': 'https://tr.linkedin.com/jobs/view/supply-chain-specialist-1',
            'source_platform': 'linkedin',
            'location': 'Aliaga, Turkiye',
            'description': 'Minimum of 3 years experience within a similar role. Experience in Supply Chain, Material planning or Production Planning.',
        }

        with self.assertRaises(DropItem):
            self.pipeline.process_item(item, self.spider)

        self.assertFalse(Listing.objects.exists())
        self.assertIn(
            (
                'info',
                'INELIGIBLE_FOR_STUDENTS_SKIPPED: Supply Chain Specialist | reason=minimum_years_experience_en',
            ),
            self.spider.logger.messages,
        )

    def test_drops_experience_range_listing_before_db_write(self):
        item = {
            'title': 'Demand Planner',
            'company_name': 'Kraft Heinz',
            'source_url': 'https://tr.linkedin.com/jobs/view/demand-planner-1',
            'application_url': 'https://tr.linkedin.com/jobs/view/demand-planner-1',
            'source_platform': 'linkedin',
            'location': 'Istanbul, Turkiye',
            'description': '1-3 years working experience in demand roles.',
        }

        with self.assertRaises(DropItem):
            self.pipeline.process_item(item, self.spider)

        self.assertFalse(Listing.objects.exists())
        self.assertIn(
            (
                'info',
                'INELIGIBLE_FOR_STUDENTS_SKIPPED: Demand Planner | reason=years_experience_range_en',
            ),
            self.spider.logger.messages,
        )

    def test_keeps_mixed_student_and_recent_graduate_listing(self):
        item = {
            'title': 'Supply Chain Internship',
            'company_name': 'Example Company',
            'source_url': 'https://tr.linkedin.com/jobs/view/supply-chain-intern-1',
            'application_url': 'https://company.example/apply',
            'source_platform': 'linkedin',
            'location': 'Turkiye',
            'description': 'Open to 3rd/4th year students or recent graduates in engineering.',
        }

        filtered_item = self.pipeline.process_item(item, self.spider)
        self.orm_pipeline.process_item(filtered_item, self.spider)

        self.assertTrue(Listing.objects.filter(source_url='https://tr.linkedin.com/jobs/view/supply-chain-intern-1').exists())


class ProductionListingFixtureCommandTests(TestCase):
    def create_listing(self, **overrides):
        payload = {
            'title': 'PythianGo Intern',
            'company_name': 'Example Company',
            'source_url': 'https://panel.pythiango.com/student/jobs/job-123',
            'application_url': 'https://company.example/apply',
            'source_platform': 'pythiango',
            'em_focus_area': 'diger',
            'internship_type': 'belirsiz',
            'company_origin': 'belirsiz',
            'location': 'Istanbul',
            'description': 'Support operations and improvement projects.',
            'requirements': 'Analytical thinking',
        }
        payload.update(overrides)
        return Listing.objects.create(**payload)

    def test_export_and_import_round_trip_recreates_and_updates_listings(self):
        original = self.create_listing()

        with TemporaryDirectory() as temp_dir:
            fixture_path = Path(temp_dir) / 'production_real_listings.json'
            export_output = StringIO()
            call_command('export_listings', path=str(fixture_path), stdout=export_output)

            self.assertTrue(fixture_path.exists())
            self.assertIn('Exported 1 listings', export_output.getvalue())

            Listing.objects.all().delete()

            create_output = StringIO()
            call_command('import_production_listings', path=str(fixture_path), stdout=create_output)

            recreated = Listing.objects.get(source_url=original.source_url)
            self.assertEqual(recreated.title, 'PythianGo Intern')
            self.assertEqual(recreated.source_platform, 'pythiango')
            self.assertIn('created=1 updated=0 total=1', create_output.getvalue())

            recreated.title = 'Stale Title'
            recreated.save(update_fields=['title'])

            update_output = StringIO()
            call_command('import_production_listings', path=str(fixture_path), stdout=update_output)

            recreated.refresh_from_db()
            self.assertEqual(recreated.title, 'PythianGo Intern')
            self.assertIn('created=0 updated=1 total=1', update_output.getvalue())

    def test_export_public_listing_snapshot_writes_visible_listings_and_featured_subset(self):
        student = get_user_model().objects.create_user(
            username='snapshot-user',
            iuc_email='snapshot-user@ogr.iuc.edu.tr',
            email='snapshot-user@ogr.iuc.edu.tr',
            password='test-pass-123',
        )
        featured_listing = self.create_listing(
            title='Featured Snapshot Listing',
            source_url='https://example.com/listing/featured-snapshot',
            is_homepage_featured=True,
            homepage_featured_rank=1,
        )
        duplicate_listing = self.create_listing(
            title='Duplicate Snapshot Listing',
            source_url='https://example.com/listing/duplicate-snapshot',
            canonical_listing=featured_listing,
        )
        self.create_listing(
            title='Inactive Snapshot Listing',
            source_url='https://example.com/listing/inactive-snapshot',
            is_active=False,
        )
        Bookmark.objects.create(student=student, listing=featured_listing)
        Review.objects.create(
            listing=featured_listing,
            student=student,
            rating=5,
            comment='Strong internship program',
            internship_year=2026,
            is_anonymous=True,
        )

        with TemporaryDirectory() as temp_dir:
            snapshot_path = Path(temp_dir) / 'public_listings_snapshot.json'
            output = StringIO()

            call_command('export_public_listing_snapshot', path=str(snapshot_path), stdout=output)

            payload = json.loads(snapshot_path.read_text(encoding='utf-8'))
            self.assertEqual(payload['count'], 1)
            self.assertEqual([row['title'] for row in payload['listings']], ['Featured Snapshot Listing'])
            self.assertEqual(payload['listings'][0]['bookmark_count'], 1)
            self.assertEqual(payload['listings'][0]['average_rating'], 5.0)
            self.assertEqual([row['title'] for row in payload['featured_listings']], ['Featured Snapshot Listing'])
            self.assertNotIn('Duplicate Snapshot Listing', json.dumps(payload, ensure_ascii=False))
            self.assertIn('Exported public snapshot with 1 listings', output.getvalue())

    def test_sync_production_listings_runs_scrapers_then_exports_and_prints_summary(self):
        self.create_listing()
        self.create_listing(
            title='Youthall Program',
            source_url='https://www.youthall.com/tr/example/youthall-program_1/',
            source_platform='youthall',
            application_url='https://www.youthall.com/tr/example/youthall-program_1/apply/',
            canonical_listing=None,
        )

        recorded_commands = []
        original_call_command = call_command

        def fake_call_command(name, *args, **kwargs):
            recorded_commands.append(name)
            if name in {
                'run_scrapers',
                'audit_listing_deadlines',
                'audit_listing_eligibility',
                'cleanup_production_listings',
            }:
                return None
            return original_call_command(name, *args, **kwargs)

        with TemporaryDirectory() as temp_dir:
            fixture_path = Path(temp_dir) / 'production_real_listings.json'
            public_snapshot_path = Path(temp_dir) / 'public_listings_snapshot.json'
            frontend_snapshot_path = Path(temp_dir) / 'frontend-public-listings-snapshot.json'
            output = StringIO()

            with patch(
                'apps.listings.management.commands.sync_production_listings.call_command',
                side_effect=fake_call_command,
            ):
                call_command(
                    'sync_production_listings',
                    path=str(fixture_path),
                    public_snapshot_path=str(public_snapshot_path),
                    frontend_snapshot_path=str(frontend_snapshot_path),
                    stdout=output,
                )

            self.assertEqual(
                recorded_commands,
                [
                    'run_scrapers',
                    'audit_listing_deadlines',
                    'audit_listing_eligibility',
                    'cleanup_production_listings',
                    'export_listings',
                    'export_public_listing_snapshot',
                    'verify_production_listing_sync',
                ],
            )
            self.assertTrue(fixture_path.exists())
            self.assertTrue(public_snapshot_path.exists())
            self.assertTrue(frontend_snapshot_path.exists())

            exported_records = json.loads(fixture_path.read_text(encoding='utf-8'))
            self.assertEqual(len(exported_records), 2)
            public_snapshot = json.loads(public_snapshot_path.read_text(encoding='utf-8'))
            self.assertEqual(public_snapshot['count'], 2)
            self.assertEqual(
                frontend_snapshot_path.read_text(encoding='utf-8'),
                public_snapshot_path.read_text(encoding='utf-8'),
            )

            rendered_output = output.getvalue()
            self.assertIn('Production fixture sync started', rendered_output)
            self.assertIn('Production fixture sync finished', rendered_output)
            self.assertIn('Public snapshot path:', rendered_output)
            self.assertIn('Frontend snapshot path:', rendered_output)
            self.assertIn('Listings summary: total=2 active=2 visible=2', rendered_output)
            self.assertIn('pythiango: total=1 active=1 visible=1', rendered_output)
            self.assertIn('youthall: total=1 active=1 visible=1', rendered_output)

    def test_verify_production_listing_sync_passes_for_recent_visible_listing(self):
        recent_listing = self.create_listing(
            title='Recent Public Listing',
            source_url='https://example.com/listing/recent-public-listing',
        )

        with TemporaryDirectory() as temp_dir:
            fixture_path = Path(temp_dir) / 'production_real_listings.json'
            public_snapshot_path = Path(temp_dir) / 'public_listings_snapshot.json'
            frontend_snapshot_path = Path(temp_dir) / 'frontend-public-listings-snapshot.json'
            output = StringIO()

            call_command('export_listings', path=str(fixture_path))
            call_command('export_public_listing_snapshot', path=str(public_snapshot_path))
            frontend_snapshot_path.write_text(public_snapshot_path.read_text(encoding='utf-8'), encoding='utf-8')
            call_command(
                'verify_production_listing_sync',
                path=str(fixture_path),
                public_snapshot_path=str(public_snapshot_path),
                frontend_snapshot_path=str(frontend_snapshot_path),
                lookback_hours=24,
                stdout=output,
            )

            rendered_output = output.getvalue()
            self.assertIn('recent_listings=1', rendered_output)
            self.assertIn('recent_public_listings=1', rendered_output)
            self.assertIn('Production listing sync verification passed.', rendered_output)

            self.assertTrue(
                json.loads(fixture_path.read_text(encoding='utf-8'))[0]['source_url']
                == recent_listing.source_url
            )

    def test_verify_production_listing_sync_fails_when_recent_public_listing_missing_from_snapshot(self):
        self.create_listing(
            title='Missing Snapshot Listing',
            source_url='https://example.com/listing/missing-snapshot-listing',
        )

        with TemporaryDirectory() as temp_dir:
            fixture_path = Path(temp_dir) / 'production_real_listings.json'
            public_snapshot_path = Path(temp_dir) / 'public_listings_snapshot.json'

            call_command('export_listings', path=str(fixture_path))
            public_snapshot_path.write_text(
                json.dumps({'generated_at': timezone.now().isoformat(), 'count': 0, 'listings': [], 'featured_listings': []}),
                encoding='utf-8',
            )

            with self.assertRaises(CommandError) as exc:
                call_command(
                    'verify_production_listing_sync',
                    path=str(fixture_path),
                    public_snapshot_path=str(public_snapshot_path),
                    lookback_hours=24,
                )

            self.assertIn('Missing from public snapshot', str(exc.exception))


class AuthApiTests(TestCase):
    def create_student(self, **overrides):
        payload = {
            'username': 'student-auth',
            'iuc_email': 'student-auth@ogr.iuc.edu.tr',
            'email': 'student-auth@ogr.iuc.edu.tr',
            'is_verified': True,
        }
        password = overrides.pop('password', 'test-pass-123')
        payload.update(overrides)
        student = get_user_model().objects.create_user(password=password, **payload)
        if student.is_verified != payload['is_verified']:
            student.is_verified = payload['is_verified']
            student.save(update_fields=['is_verified'])
        return student

    def test_account_status_returns_existing_student_verification_state(self):
        self.create_student(
            username='account-status-student',
            iuc_email='account-status@ogr.iuc.edu.tr',
            email='account-status@ogr.iuc.edu.tr',
            is_verified=True,
        )

        response = self.client.post(
            '/api/auth/account-status/',
            data=json.dumps({'email': 'account-status@ogr.iuc.edu.tr'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'exists': True, 'is_verified': True})

    def test_login_returns_tokens_for_verified_student(self):
        student = self.create_student(
            username='verified-login-student',
            iuc_email='verified-login@ogr.iuc.edu.tr',
            email='verified-login@ogr.iuc.edu.tr',
            password='verified-pass-123',
            is_verified=True,
            first_name='Ali',
            last_name='Beyazay',
        )

        response = self.client.post(
            '/api/auth/login/',
            data=json.dumps(
                {
                    'email': 'verified-login@ogr.iuc.edu.tr',
                    'password': 'verified-pass-123',
                }
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('access', payload)
        self.assertIn('refresh', payload)
        self.assertEqual(payload['user']['id'], str(student.id))
        self.assertTrue(payload['user']['is_verified'])

    def test_login_rejects_unverified_student(self):
        self.create_student(
            username='unverified-login-student',
            iuc_email='unverified-login@ogr.iuc.edu.tr',
            email='unverified-login@ogr.iuc.edu.tr',
            password='verified-pass-123',
            is_verified=False,
        )

        response = self.client.post(
            '/api/auth/login/',
            data=json.dumps(
                {
                    'email': 'unverified-login@ogr.iuc.edu.tr',
                    'password': 'verified-pass-123',
                }
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn('doğrulanmad', response.json()['detail'].lower())


class ProductionStartupScriptTests(SimpleTestCase):
    def test_startup_script_skips_network_dependent_maintenance(self):
        script_path = Path(__file__).resolve().parents[2] / 'start-production.sh'
        script = script_path.read_text(encoding='utf-8')

        self.assertIn('python manage.py import_production_listings', script)
        self.assertNotIn('audit_listing_deadlines', script)
        self.assertNotIn('audit_listing_eligibility', script)
        self.assertNotIn('delete_listing', script)


class ListingDeadlineAuditCommandTests(TestCase):
    def create_listing(self, **overrides):
        payload = {
            'title': 'Deadline Test Listing',
            'company_name': 'Example Company',
            'source_url': 'https://example.com/listing/deadline-test',
            'application_url': 'https://example.com/apply/deadline-test',
            'source_platform': 'youthall',
            'em_focus_area': 'diger',
            'internship_type': 'belirsiz',
            'company_origin': 'belirsiz',
            'location': 'Istanbul',
            'description': 'Support operations and improvement projects.',
            'requirements': '',
        }
        payload.update(overrides)
        return Listing.objects.create(**payload)

    def test_audit_command_updates_deadlines_statuses_and_preserves_manual_inactive(self):
        expired = self.create_listing(
            title='Expired Listing',
            source_url='https://example.com/listing/expired',
            application_deadline=date.today() - timedelta(days=1),
            deadline_status='normal',
            is_active=True,
        )
        urgent = self.create_listing(
            title='Urgent Listing',
            source_url='https://example.com/listing/urgent',
            application_deadline=date.today() + timedelta(days=3),
            deadline_status='normal',
            is_active=True,
        )
        normal = self.create_listing(
            title='Normal Listing',
            source_url='https://example.com/listing/normal',
            application_deadline=date.today() + timedelta(days=20),
            deadline_status='urgent',
            is_active=True,
        )
        upcoming = self.create_listing(
            title='Upcoming Listing',
            source_url='https://example.com/listing/upcoming',
            application_url=None,
            application_deadline=None,
            deadline_status='upcoming',
            is_active=True,
        )
        manual_inactive = self.create_listing(
            title='Manual Inactive Listing',
            source_url='https://example.com/listing/manual-inactive',
            application_deadline=date.today() + timedelta(days=5),
            deadline_status='normal',
            is_active=False,
        )
        stale = self.create_listing(
            title='Stale Unknown Listing',
            source_url='https://example.com/listing/stale',
            application_url=None,
            application_deadline=None,
            deadline_status='unknown',
            is_active=True,
        )
        Listing.objects.filter(id=stale.id).update(created_at=timezone.now() - timedelta(days=91))

        output = StringIO()
        call_command('audit_listing_deadlines', stdout=output)

        expired.refresh_from_db()
        urgent.refresh_from_db()
        normal.refresh_from_db()
        upcoming.refresh_from_db()
        manual_inactive.refresh_from_db()
        stale.refresh_from_db()

        self.assertFalse(expired.is_active)
        self.assertEqual(expired.deadline_status, 'expired')
        self.assertTrue(urgent.is_active)
        self.assertEqual(urgent.deadline_status, 'urgent')
        self.assertTrue(normal.is_active)
        self.assertEqual(normal.deadline_status, 'normal')
        self.assertTrue(upcoming.is_active)
        self.assertEqual(upcoming.deadline_status, 'upcoming')
        self.assertFalse(manual_inactive.is_active)
        self.assertEqual(manual_inactive.deadline_status, 'urgent')
        self.assertFalse(stale.is_active)
        self.assertEqual(stale.deadline_status, 'expired')
        self.assertIn('Deadline audit finished:', output.getvalue())

    @patch('apps.listings.deadline_audit.extract_deadline_from_remote_page')
    def test_audit_command_prefers_application_url_then_description_fallback(self, remote_deadline_mock):
        remote_first = self.create_listing(
            title='Remote First Listing',
            source_url='https://example.com/listing/remote-first',
            application_url='https://example.com/apply/remote-first',
            application_deadline=None,
            deadline_status='unknown',
            description='Son başvuru: 27 Mart 2099',
        )
        description_fallback = self.create_listing(
            title='Description Fallback Listing',
            source_url='https://example.com/listing/description-fallback',
            application_url='https://example.com/apply/description-fallback',
            application_deadline=None,
            deadline_status='unknown',
            description='Application Deadline: March 22nd, 2099',
        )

        def remote_side_effect(url, **kwargs):
            if url.endswith('remote-first'):
                return date(2099, 3, 30)
            return None

        remote_deadline_mock.side_effect = remote_side_effect

        call_command('audit_listing_deadlines')

        remote_first.refresh_from_db()
        description_fallback.refresh_from_db()

        self.assertEqual(remote_first.application_deadline, date(2099, 3, 30))
        self.assertEqual(description_fallback.application_deadline, date(2099, 3, 22))
        self.assertEqual(remote_first.deadline_status, 'normal')
        self.assertEqual(description_fallback.deadline_status, 'normal')


class ListingEligibilityAuditCommandTests(TestCase):
    def create_listing(self, **overrides):
        payload = {
            'title': 'Eligibility Test Listing',
            'company_name': 'Example Company',
            'source_url': 'https://example.com/listing/eligibility-test',
            'application_url': 'https://example.com/apply/eligibility-test',
            'source_platform': 'linkedin',
            'em_focus_area': 'diger',
            'internship_type': 'belirsiz',
            'company_origin': 'belirsiz',
            'location': 'Istanbul',
            'description': 'Support operations and improvement projects.',
            'requirements': '',
        }
        payload.update(overrides)
        return Listing.objects.create(**payload)

    def test_audit_command_deactivates_graduate_only_listings_and_preserves_manual_inactive(self):
        graduate_only = self.create_listing(
            title='Software QA Intern',
            source_url='https://example.com/listing/graduate-only',
            description='This position is only open to graduates.',
            is_active=True,
        )
        mixed_eligibility = self.create_listing(
            title='Supply Chain Internship',
            source_url='https://example.com/listing/mixed-eligibility',
            description='Open to 3rd/4th year students or recent graduates.',
            is_active=True,
        )
        graduate_welcome = self.create_listing(
            title='Operations Internship',
            source_url='https://example.com/listing/graduate-welcome',
            description='New graduates are welcome to apply alongside students.',
            is_active=True,
        )
        manual_inactive = self.create_listing(
            title='Manual Inactive Graduate Listing',
            source_url='https://example.com/listing/manual-inactive-graduate',
            description='Graduates only.',
            is_active=False,
        )
        experienced_role = self.create_listing(
            title='Elektronik Harp Proje Mühendisi',
            source_url='https://example.com/listing/experienced-role',
            description='Tercihen Savunma Sanayii projelerinde proje yönetimi alanında en az 3 yıl tecrübe sahibi.',
            is_active=True,
        )

        experienced_role_english = self.create_listing(
            title='Supply Chain Specialist',
            source_url='https://example.com/listing/experienced-role-english',
            description='Minimum of 3 years experience within a similar role. Experience in Supply Chain, Material planning or Production Planning.',
            is_active=True,
        )

        output = StringIO()
        call_command('audit_listing_eligibility', stdout=output)

        graduate_only.refresh_from_db()
        mixed_eligibility.refresh_from_db()
        graduate_welcome.refresh_from_db()
        manual_inactive.refresh_from_db()
        experienced_role.refresh_from_db()
        experienced_role_english.refresh_from_db()

        self.assertFalse(graduate_only.is_active)
        self.assertTrue(mixed_eligibility.is_active)
        self.assertTrue(graduate_welcome.is_active)
        self.assertFalse(manual_inactive.is_active)
        self.assertFalse(experienced_role.is_active)
        self.assertFalse(experienced_role_english.is_active)
        self.assertIn('Eligibility audit finished:', output.getvalue())

    def test_audit_command_hides_ineligible_listing_from_api(self):
        self.create_listing(
            title='Software QA Intern',
            source_url='https://example.com/listing/graduate-only-api',
            description='This position is only open to graduates.',
            is_active=True,
        )
        self.create_listing(
            title='Elektronik Harp Proje Mühendisi',
            source_url='https://example.com/listing/experienced-role-api',
            description='Tercihen 4-8 yıl deneyimli.',
            is_active=True,
        )
        self.create_listing(
            title='Student Friendly Internship',
            source_url='https://example.com/listing/student-friendly',
            description='Open to undergraduate students or recent graduates.',
            is_active=True,
        )

        self.create_listing(
            title='Supply Chain Specialist',
            source_url='https://example.com/listing/experienced-role-api-english',
            description='Minimum of 3 years experience within a similar role.',
            is_active=True,
        )

        call_command('audit_listing_eligibility')
        response = self.client.get('/api/listings/?limit=50')

        self.assertEqual(response.status_code, 200)
        titles = [item['title'] for item in response.json()['results']]
        self.assertNotIn('Software QA Intern', titles)
        self.assertNotIn('Elektronik Harp Proje Mühendisi', titles)
        self.assertNotIn('Supply Chain Specialist', titles)
        self.assertIn('Student Friendly Internship', titles)
