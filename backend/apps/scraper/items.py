import scrapy
from datetime import datetime, date


class ScrapedListingItem(scrapy.Item):
    title               = scrapy.Field()
    company_name        = scrapy.Field()
    company_logo_url    = scrapy.Field()
    source_url          = scrapy.Field()      # unique dedup key
    application_url     = scrapy.Field()      # direct listing/apply link shown to users
    source_platform     = scrapy.Field()      # linkedin|youthall|anbea|boomerang|toptalent|savunma
    em_focus_area       = scrapy.Field()      # auto-detected sector
    secondary_em_focus_area = scrapy.Field()  # optional second-best sector
    em_focus_confidence = scrapy.Field()      # confidence score 0-100
    internship_type     = scrapy.Field()      # zorunlu|gonullu|belirsiz
    company_origin      = scrapy.Field()      # yerli|yabanci|belirsiz
    location            = scrapy.Field()
    description         = scrapy.Field()
    requirements        = scrapy.Field()
    application_deadline = scrapy.Field()     # date | None
    deadline_status     = scrapy.Field()      # urgent|normal|unknown|upcoming|expired
    is_active           = scrapy.Field()
    is_talent_program   = scrapy.Field()
    program_type        = scrapy.Field()      # yaz_staj_programi|... | None
    duration_weeks      = scrapy.Field()
    scraped_at          = scrapy.Field()
