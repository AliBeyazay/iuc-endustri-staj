from bs4 import BeautifulSoup
from django.test import SimpleTestCase

from apps.scraper.spiders.spiders import (
    extract_youthall_description,
    translate_known_youthall_description,
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
                <h4 class="u-gap-bottom">Yetenek Programı Detayları</h4>
                <div class="l-grid">
                  <div class="l-grid__col--lg-12 l-grid__col--xs-12 c-talent-program-li">
                    <p><b>TechVenture Genç Yetenek Programı ile seni teknoloji dünyasında davet ediyoruz!</b></p>
                    <p>Teknoloji dünyasında fark yaratmaya ne dersin?</p>
                    <ul>
                      <li>İleri seviye İngilizce</li>
                      <li>Analitik düşünme</li>
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
            "TechVenture Genç Yetenek Programı ile seni teknoloji dünyasında davet ediyoruz!\n\n"
            "Teknoloji dünyasında fark yaratmaya ne dersin?\n\n"
            "- İleri seviye İngilizce\n"
            "- Analitik düşünme",
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
            "Are you ready to take the next step? We’d love to have you with us!\n\n"
            "#makethefuture\n\n"
            "BE PART OF SHELL"
        )

        translated = translate_known_youthall_description(
            description,
            title="Shell Türkiye Summer Training",
            company_name="Shell",
            source_url="https://www.youthall.com/tr/Shell/shell-turkiye-summer-training_1248/",
        )

        self.assertEqual(
            translated,
            "Program süresince seni neler bekliyor?\n\n"
            "- Kariyer yolunu belirlemene yardımcı olacak iş tanıtım oturumları,\n\n"
            "- Vaka analizi yarışmaları,\n\n"
            "- Liderlerimizle Tea-Talks oturumları,\n\n"
            "- İş akışlarını yerinde gözlemleyebileceğin saha ziyaretleri,\n\n"
            "- Shell'deki global kariyer fırsatlarını keşfedeceğin oturumlar.\n\n"
            "- Kişisel gelişimini destekleyecek eğitim oturumları,\n\n"
            "Eğer aşağıdaki özelliklere sahipsen, aradığımız kişi sen olabilirsin!\n\n"
            "- Üniversite hazırlık, 1. sınıf veya 2. sınıf öğrencisiysen,\n\n"
            "- Temmuz ve Ağustos ayları arasında İstanbul'da ikamet edebileceksen,\n\n"
            "- Enerji sektörüne ilgi duyuyorsan,\n\n"
            "- Yaratıcı ve yenilikçi bir bakış açısına sahipsen,\n\n"
            "- İngilizcene güveniyorsan,\n\n"
            "Bir sonraki adımı atmaya hazır mısın? Seni aramızda görmekten memnuniyet duyarız!\n\n"
            "#makethefuture\n\n"
            "SHELL'İN BİR PARÇASI OL",
        )
