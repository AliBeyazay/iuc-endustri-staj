# ─── scraper/settings.py ─────────────────────────────────────────────────────

BOT_NAME = 'iuc_scraper'
SPIDER_MODULES = ['apps.scraper.spiders']
ROBOTSTXT_OBEY = False

CONCURRENT_REQUESTS            = 4
DOWNLOAD_DELAY                 = 2.0
RANDOMIZE_DOWNLOAD_DELAY       = True
AUTOTHROTTLE_ENABLED           = True
AUTOTHROTTLE_START_DELAY       = 1
AUTOTHROTTLE_MAX_DELAY         = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0

DOWNLOADER_MIDDLEWARES = {
    'apps.scraper.middlewares.RotatingUserAgentMiddleware': 400,
    'apps.scraper.middlewares.RetryOn429Middleware': 550,
    'scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler': 900,
}

DOWNLOAD_HANDLERS = {
    'http':  'scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler',
    'https': 'scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler',
}

PLAYWRIGHT_BROWSER_TYPE    = 'chromium'
PLAYWRIGHT_LAUNCH_OPTIONS  = {
    'headless': True,
    'args': ['--no-sandbox', '--disable-dev-shm-usage'],
}
TWISTED_REACTOR = 'twisted.internet.asyncioreactor.AsyncioSelectorReactor'

ITEM_PIPELINES = {
    'apps.scraper.pipelines.DeadlineValidationPipeline': 100,
    'apps.scraper.pipelines.DjangoORMPipeline': 200,
}

LOG_LEVEL = 'INFO'
