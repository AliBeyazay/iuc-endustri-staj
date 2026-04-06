import json
from datetime import date, timedelta
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.contrib.admin.models import DELETION, LogEntry
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.management import call_command
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from scrapy.exceptions import DropItem

from apps.listings.admin import ListingAdmin
from apps.listings.cache_keys import get_listing_list_cache_version
from apps.listings.eligibility import classify_student_eligibility
from apps.listings.models import Listing, SuppressedListingSource
from apps.listings.runtime import get_admin_runtime_info
from apps.listings.sync import delete_listing_groups
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

    @override_settings(ENVIRONMENT='dev', FRONTEND_URL='http://localhost:3000')
    def test_admin_index_shows_runtime_banner(self):
        admin_user = get_user_model().objects.create_superuser(
            username='admin',
            iuc_email='admin@iuc.edu.tr',
            email='admin@iuc.edu.tr',
            password='test-pass-123',
        )
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
        admin_user = get_user_model().objects.create_superuser(
            username='admin-log',
            iuc_email='admin-log@iuc.edu.tr',
            email='admin-log@iuc.edu.tr',
            password='test-pass-123',
        )
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
            if name in {'run_scrapers', 'audit_listing_deadlines', 'audit_listing_eligibility'}:
                return None
            return original_call_command(name, *args, **kwargs)

        with TemporaryDirectory() as temp_dir:
            fixture_path = Path(temp_dir) / 'production_real_listings.json'
            output = StringIO()

            with patch(
                'apps.listings.management.commands.sync_production_listings.call_command',
                side_effect=fake_call_command,
            ):
                call_command(
                    'sync_production_listings',
                    path=str(fixture_path),
                    stdout=output,
                )

            self.assertEqual(
                recorded_commands,
                ['run_scrapers', 'audit_listing_deadlines', 'audit_listing_eligibility', 'export_listings'],
            )
            self.assertTrue(fixture_path.exists())

            exported_records = json.loads(fixture_path.read_text(encoding='utf-8'))
            self.assertEqual(len(exported_records), 2)

            rendered_output = output.getvalue()
            self.assertIn('Production fixture sync started', rendered_output)
            self.assertIn('Production fixture sync finished', rendered_output)
            self.assertIn('Listings summary: total=2 active=2 visible=2', rendered_output)
            self.assertIn('pythiango: total=1 active=1 visible=1', rendered_output)
            self.assertIn('youthall: total=1 active=1 visible=1', rendered_output)


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

        output = StringIO()
        call_command('audit_listing_eligibility', stdout=output)

        graduate_only.refresh_from_db()
        mixed_eligibility.refresh_from_db()
        graduate_welcome.refresh_from_db()
        manual_inactive.refresh_from_db()
        experienced_role.refresh_from_db()

        self.assertFalse(graduate_only.is_active)
        self.assertTrue(mixed_eligibility.is_active)
        self.assertTrue(graduate_welcome.is_active)
        self.assertFalse(manual_inactive.is_active)
        self.assertFalse(experienced_role.is_active)
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

        call_command('audit_listing_eligibility')
        response = self.client.get('/api/listings/?limit=50')

        self.assertEqual(response.status_code, 200)
        titles = [item['title'] for item in response.json()['results']]
        self.assertNotIn('Software QA Intern', titles)
        self.assertNotIn('Elektronik Harp Proje Mühendisi', titles)
        self.assertIn('Student Friendly Internship', titles)
