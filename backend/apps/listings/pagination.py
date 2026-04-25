from rest_framework.pagination import PageNumberPagination


class ListingPageNumberPagination(PageNumberPagination):
    """
    Özelleştirilmiş sayfalama sınıfı.

    Desteklenen query param'lar:
      ?page=N      → N. sayfaya git (default 1)
      ?limit=N     → Sayfa başına sonuç sayısını ayarla (max 100, default 20)

    Örnek: GET /api/listings/?page=2&limit=30
    """

    page_size = 20
    page_size_query_param = 'limit'
    max_page_size = 100
    page_query_param = 'page'
