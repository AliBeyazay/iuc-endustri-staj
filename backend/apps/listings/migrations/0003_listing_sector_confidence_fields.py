from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0002_listing_application_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='listing',
            name='secondary_em_focus_area',
            field=models.CharField(blank=True, choices=[('imalat_metal_makine', 'İmalat, Metal ve Makine'), ('otomotiv_yan_sanayi', 'Otomotiv ve Yan Sanayi'), ('yazilim_bilisim_teknoloji', 'Yazılım, Bilişim ve Teknoloji'), ('hizmet_finans_danismanlik', 'Hizmet, Finans ve Danışmanlık'), ('eticaret_perakende_fmcg', 'E-Ticaret, Perakende ve FMCG'), ('savunma_havacilik_enerji', 'Savunma, Havacılık ve Enerji'), ('gida_kimya_saglik', 'Gıda, Kimya ve Sağlık'), ('lojistik_tasimacilık', 'Lojistik ve Taşımacılık'), ('tekstil_moda', 'Tekstil ve Moda'), ('insaat_yapi_malzemeleri', 'İnşaat ve Yapı Malzemeleri'), ('diger', 'Diğer')], max_length=30, null=True),
        ),
        migrations.AddField(
            model_name='listing',
            name='em_focus_confidence',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
    ]
