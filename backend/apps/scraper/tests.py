from io import StringIO

from django.conf import settings
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from bs4 import BeautifulSoup
from django_celery_beat.models import CrontabSchedule, PeriodicTask, PeriodicTasks

from apps.scraper.beat_schedule import MANAGED_BEAT_SCHEDULES
from apps.scraper.tasks import (
    _count_rate_limit_signals,
    _linkedin_retry_delay,
    _should_retry_linkedin_rate_limit,
)
from apps.scraper.spiders.spiders import LinkedInSpider
from apps.scraper.spiders.spiders import (
    extract_youthall_description,
    translate_known_youthall_description,
)
from apps.scraper.youthall_company_names import (
    dedupe_company_names,
    extract_company_names_from_html,
)


class YouthallDescriptionExtractionTests(SimpleTestCase):
    def test_extracts_direct_job_post_content(self):
        html = """
        <html>
          <body>
            <div class="c-job_post_content">
              <p><b>About this Position&nbsp;</b></p>
              <p><i>Chaingers: Operations Leadership Program</i> is one of Henkel's flagship talent programs.</p>
              <p><b>What You'll Do</b></p>
              <ul>
                <li>Lead critical projects.</li>
                <li>Drive digital transformation.</li>
              </ul>
            </div>
          </body>
        </html>
        """

        description = extract_youthall_description(BeautifulSoup(html, "html.parser"))

        self.assertEqual(
            description,
            "About this Position\n\n"
            "Chaingers: Operations Leadership Program is one of Henkel's flagship talent programs.\n\n"
            "What You'll Do\n\n"
            "- Lead critical projects.\n"
            "- Drive digital transformation.",
        )

    def test_falls_back_to_jobposting_schema_description(self):
        html = """
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "JobPosting",
                "description": "<p><b>About this Position</b></p><p>Structured growth opportunity.</p>"
              }
            </script>
          </head>
        </html>
        """

        description = extract_youthall_description(BeautifulSoup(html, "html.parser"))

        self.assertEqual(
            description,
            "About this Position\n\nStructured growth opportunity.",
        )

    def test_extracts_talent_program_detail_body(self):
        html = """
        <html>
          <body>
            <div id="tabs-talent-program-details" class="c-tabs__content-item is-active">
              <div class="c-profile-home-section bg-white u-gap-bottom shadow-light">
                <h4 class="u-gap-bottom">Talent Program Details</h4>
                <div class="l-grid">
                  <div class="l-grid__col--lg-12 l-grid__col--xs-12 c-talent-program-li">
                    <p><b>TechVenture invites you into the world of technology.</b></p>
                    <p>Are you ready to make an impact?</p>
                    <ul>
                      <li>Advanced English</li>
                      <li>Analytical thinking</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
        """

        description = extract_youthall_description(BeautifulSoup(html, "html.parser"))

        self.assertEqual(
            description,
            "TechVenture invites you into the world of technology.\n\n"
            "Are you ready to make an impact?\n\n"
            "- Advanced English\n"
            "- Analytical thinking",
        )

    def test_translates_shell_summer_training_copy_to_turkish(self):
        description = (
            "What awaits you during the program?\n\n"
            "- Job introduction sessions to help you determine your career path,\n\n"
            "- Case analysis competitions,\n\n"
            "- Tea-Talks session with our leaders,\n\n"
            "- Site visits where you can observe workflows on site,\n\n"
            "- Sessions to explore Global career opportunities at Shell.\n\n"
            "- Training sessions for your personal development,\n\n"
            "You can be the one! If you are...\n\n"
            "- A university preparatory, 1st or 2nd year student,\n\n"
            "- Reside in Istanbul between July and August,\n\n"
            "- Interested in the energy sector,\n\n"
            "- A creative and innovative perspective,\n\n"
            "- A confident in your English,\n\n"
            "Are you ready to take the next step? We\u2019d love to have you with us!\n\n"
            "#makethefuture\n\n"
            "BE PART OF SHELL"
        )

        translated = translate_known_youthall_description(
            description,
            title="Shell T\u00fcrkiye Summer Training",
            company_name="Shell",
            source_url="https://www.youthall.com/tr/Shell/shell-turkiye-summer-training_1248/",
        )

        self.assertIn("Program s\u00fcresince seni neler bekliyor?", translated)
        self.assertIn(
            "Kariyer yolunu belirlemene yard\u0131mc\u0131 olacak i\u015f tan\u0131t\u0131m oturumlar\u0131",
            translated,
        )
        self.assertIn("SHELL'\u0130N B\u0130R PAR\u00c7ASI OL", translated)
        self.assertIn("#makethefuture", translated)
        self.assertNotIn("What awaits you during the program?", translated)


class YouthallCompanyNameExtractionTests(SimpleTestCase):
    def test_extracts_only_real_company_card_names(self):
        html = """
        <html>
          <body>
            <a href="/tr/drager"><h3>Dr\u00e4ger Youthall Verified Badge</h3></a>
            <a href="/tr/betekboya"><h3>Betek Boya</h3></a>
            <a href="/tr/ray-sigorta"><h3>Ray Sigorta</h3></a>
            <a href="/tr/companies/all?page=2"><h3>T\u00fcm \u015eirketler</h3></a>
            <a href="/tr/blog"><h3>Blog</h3></a>
            <a href="/tr/giris"><h3>Giri\u015f Yap</h3></a>
            <a href="https://example.com/not-youthall"><h3>External Site</h3></a>
          </body>
        </html>
        """

        self.assertEqual(
            extract_company_names_from_html(html),
            ["Dr\u00e4ger", "Betek Boya", "Ray Sigorta"],
        )

    def test_dedupes_names_while_preserving_order(self):
        names = ["Dr\u00e4ger", "Betek Boya", "dr\u00e4ger", " Betek   Boya ", "Adobe"]

        self.assertEqual(
            dedupe_company_names(names),
            ["Dr\u00e4ger", "Betek Boya", "Adobe"],
        )


class LinkedInSpiderTests(SimpleTestCase):
    def setUp(self):
        self.spider = LinkedInSpider()

    def test_build_search_urls_uses_priority_depths_without_duplicates(self):
        urls = self.spider.build_search_urls()
        high_priority_count = len(self.spider.SEARCH_QUERY_GROUPS[0]["queries"])
        secondary_count = len(self.spider.SEARCH_QUERY_GROUPS[1]["queries"])

        self.assertEqual(
            len(urls),
            (high_priority_count * len(self.spider.HIGH_PRIORITY_PAGE_STARTS))
            + (secondary_count * len(self.spider.SECONDARY_PAGE_STARTS)),
        )
        self.assertEqual(len(urls), len(set(urls)))
        self.assertIn(
            "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
            "?keywords=industrial+engineering+intern+turkey&location=Turkey&start=175",
            urls,
        )
        self.assertIn(
            "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
            "?keywords=long+term+intern+turkey&location=Turkey&start=75",
            urls,
        )

    def test_scores_relevant_em_internships_above_threshold(self):
        score = self.spider.score_em_relevance(
            "Industrial Engineering Intern",
            "Support supply chain planning, SAP reporting and process improvement projects.",
        )

        self.assertGreaterEqual(score, self.spider.MIN_EM_RELEVANCE_SCORE)

    def test_scores_non_em_internships_below_threshold(self):
        score = self.spider.score_em_relevance(
            "HR Intern",
            "Support human resources onboarding, recruitment reporting and employer branding.",
        )

        self.assertLess(score, self.spider.MIN_EM_RELEVANCE_SCORE)

    def test_remote_locations_need_turkiye_context(self):
        self.assertTrue(self.spider.is_remote_or_hybrid_location("Remote"))
        self.assertTrue(
            self.spider.has_turkiye_context(
                "Remote",
                "Open to candidates based in Turkey and Istanbul.",
                "Global Company",
            )
        )
        self.assertTrue(
            self.spider.has_turkiye_context(
                "Hybrid",
                "Coordinate improvement projects across teams.",
                "TEI",
            )
        )
        self.assertFalse(
            self.spider.has_turkiye_context(
                "Remote",
                "Role supports operations in Germany and Poland.",
                "Global Company",
            )
        )


class LinkedInTaskHelperTests(SimpleTestCase):
    def test_counts_rate_limit_lines_once_per_log_line(self):
        output = "\n".join(
            [
                "RATE_LIMITED (429): https://linkedin.example/1",
                "Service Unavailable (503): https://linkedin.example/2",
                "ordinary info log line",
            ]
        )

        self.assertEqual(_count_rate_limit_signals(output), 2)

    def test_linkedin_retry_helpers_only_retry_on_repeated_empty_rate_limit(self):
        self.assertEqual(_linkedin_retry_delay(0), 60)
        self.assertEqual(_linkedin_retry_delay(2), 240)
        self.assertTrue(
            _should_retry_linkedin_rate_limit(
                3,
                {'new_count': 0, 'updated_count': 0, 'skipped_count': 10, 'error_count': 0},
            )
        )
        self.assertFalse(
            _should_retry_linkedin_rate_limit(
                1,
                {'new_count': 0, 'updated_count': 0, 'skipped_count': 0, 'error_count': 0},
            )
        )
        self.assertFalse(
            _should_retry_linkedin_rate_limit(
                3,
                {'new_count': 2, 'updated_count': 0, 'skipped_count': 0, 'error_count': 0},
            )
        )


class CeleryBeatSyncCommandTests(TestCase):
    def create_legacy_task(self, name, task_name):
        schedule, _ = CrontabSchedule.objects.get_or_create(
            minute='0',
            hour='8',
            day_of_week='*',
            day_of_month='*',
            month_of_year='*',
            timezone=settings.CELERY_TIMEZONE,
        )
        return PeriodicTask.objects.create(
            name=name,
            task=task_name,
            crontab=schedule,
            enabled=True,
        )

    def test_sync_celery_beat_creates_managed_tasks_and_disables_legacy_entries(self):
        self.create_legacy_task('morning-scrape', 'apps.scraper.tasks.run_non_linkedin_scrapers')
        self.create_legacy_task('evening-scrape', 'apps.scraper.tasks.run_non_linkedin_scrapers')
        self.create_legacy_task('linkedin-night-scrape', 'apps.scraper.tasks.run_linkedin_scraper')

        output = StringIO()
        call_command('sync_celery_beat', stdout=output)

        all_scrape = PeriodicTask.objects.get(name='all-scrape')
        self.assertEqual(all_scrape.task, 'apps.scraper.tasks.run_all_scrapers')
        self.assertTrue(all_scrape.enabled)
        self.assertEqual(all_scrape.crontab.minute, '0')
        self.assertEqual(all_scrape.crontab.hour, '2')
        self.assertEqual(str(all_scrape.crontab.timezone), settings.CELERY_TIMEZONE)

        self.assertTrue(PeriodicTask.objects.get(name='expire-check').enabled)
        self.assertTrue(PeriodicTask.objects.get(name='weekly-digest').enabled)
        self.assertFalse(PeriodicTask.objects.get(name='morning-scrape').enabled)
        self.assertFalse(PeriodicTask.objects.get(name='evening-scrape').enabled)
        self.assertFalse(PeriodicTask.objects.get(name='linkedin-night-scrape').enabled)
        self.assertIsNotNone(PeriodicTasks.last_change())
        self.assertIn('all-scrape', output.getvalue())

    def test_sync_celery_beat_is_idempotent(self):
        call_command('sync_celery_beat')
        call_command('sync_celery_beat')

        managed_names = set(MANAGED_BEAT_SCHEDULES.keys())
        self.assertEqual(
            set(PeriodicTask.objects.filter(name__in=managed_names).values_list('name', flat=True)),
            managed_names,
        )
        self.assertEqual(PeriodicTask.objects.filter(name='all-scrape').count(), 1)
