from bs4 import BeautifulSoup
from django.test import SimpleTestCase

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
