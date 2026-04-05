from bs4 import BeautifulSoup
from django.test import SimpleTestCase

from apps.scraper.spiders.spiders import extract_youthall_description


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
