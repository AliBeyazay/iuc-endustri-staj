import random
import time
import logging
from scrapy import signals
from scrapy.http import HtmlResponse

logger = logging.getLogger('scraper.middlewares')

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 YaBrowser/24.1.0.0 Safari/537.36',
]


class RotatingUserAgentMiddleware:
    """Rotates User-Agent header on every request."""

    def process_request(self, request, spider):
        request.headers['User-Agent'] = random.choice(USER_AGENTS)
        request.headers['Accept-Language'] = 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'


class RetryOn429Middleware:
    """
    Handles rate-limiting (429) and blocks (403/503).
    Retries 429 up to 2 times with a 60s wait.
    Skips 403 and logs it.
    """

    MAX_RETRIES = 2
    WAIT_429    = 60   # seconds

    def process_response(self, request, response, spider):
        if response.status == 429:
            retries = request.meta.get('_429_retries', 0)
            if retries < self.MAX_RETRIES:
                logger.warning(
                    f'RATE_LIMITED (429): {request.url} — '
                    f'waiting {self.WAIT_429}s (attempt {retries + 1}/{self.MAX_RETRIES})'
                )
                time.sleep(self.WAIT_429)
                retry = request.copy()
                retry.meta['_429_retries'] = retries + 1
                retry.dont_filter = True
                return retry
            else:
                logger.error(f'RATE_LIMITED_MAX_RETRIES: {request.url} — skipping')

        elif response.status == 403:
            logger.warning(f'BLOCKED (403): {request.url} — skipping')

        elif response.status == 503:
            retries = request.meta.get('_503_retries', 0)
            if retries < 1:
                time.sleep(30)
                retry = request.copy()
                retry.meta['_503_retries'] = retries + 1
                retry.dont_filter = True
                return retry

        return response

    def process_exception(self, request, exception, spider):
        logger.warning(f'DOWNLOAD_EXCEPTION: {request.url} — {exception}')
        return None
