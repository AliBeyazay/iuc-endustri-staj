import re
import unicodedata
from datetime import date, timedelta, datetime
from typing import Optional

import scrapy

from apps.listings.deadlines import parse_deadline_string


class BaseEMSpider(scrapy.Spider):
    """
    Shared logic for all IUC internship spiders.
    Handles keyword filtering, sector detection, date parsing,
    deadline validation and common field extraction.
    """

    name = "base_em"

    TR_KEYWORDS = [
        "endustri muhendisi", "endustri muhendisligi", "stajyer", "staj",
        "uretim planlama", "tedarik zinciri", "kalite yonetimi",
        "yalin uretim", "proje yonetimi", "veri analitigi", "operasyon",
        "lojistik", "imalat", "otomotiv", "savunma", "havacilik",
    ]
    EN_KEYWORDS = [
        "industrial engineering", "industrial engineer", "intern", "internship",
        "supply chain", "quality management", "lean manufacturing",
        "production planning", "project management", "operations",
        "logistics", "manufacturing", "automotive", "defence", "defense",
    ]

    # Tier-1: EM'e özgü terimler — title VEYA description'da geçmesi yeterli
    STRONG_EM_KEYWORDS = [
        "endustri muhendisi", "endustri muhendisligi",
        "industrial engineer", "industrial engineering",
        "uretim planlama", "production planning",
        "tedarik zinciri", "supply chain",
        "kalite yonetimi", "quality management",
        "yalin uretim", "lean manufacturing",
        "stok yonetimi", "inventory management",
        "surec iyilestirme", "process improvement", "process engineer",
        "is etudü",
    ]

    # Tier-2: genel endüstri/rol terimleri — YALNIZCA title'da geçmesi kabul edilir;
    # description'da tek başına yeterli değil (false positive riski yüksek)
    TITLE_ONLY_EM_KEYWORDS = [
        "imalat", "uretim", "manufacturing", "fabrika",
        "otomotiv", "automotive",
        "savunma", "defence", "defense",
        "havacilik", "aerospace", "aviation",
        "lojistik", "logistics",
        "operasyon", "operations",
        "kalite",
        "proje yonetimi", "project management",
        "veri analitigi",
    ]

    EM_SECTOR_RULES = {
        "imalat_metal_makine": {
            "positive": [
                "imalat", "metal", "makine", "mekanik", "manufacturing",
                "cnc", "kaynak", "dokum", "sac", "pres", "mekatronik",
                "fabrika", "plant", "uretim hatti",
            ],
            "negative": ["banka", "finance", "software", "pharma", "hospital"],
        },
        "otomotiv_yan_sanayi": {
            "positive": [
                "otomotiv", "automotive", "arac", "yan sanayi", "oem",
                "tier-1", "tier 1", "ford", "tofas", "oyak", "fiat",
                "renault", "toyota", "honda", "bosch", "valeo",
            ],
            "negative": ["banka", "retail", "pharma", "hospital"],
        },
        "yazilim_bilisim_teknoloji": {
            "positive": [
                "yazilim", "software", "bilisim", "teknoloji", "data",
                "veri", "analitik", "analytics", "python", "java", "sql",
                "erp", "sap", "dijital", "digital", "siber", "yapay zeka",
                "ai", "developer", "cloud", "frontend", "backend",
            ],
            "negative": ["uretim hatti", "pharma lab", "hastane"],
        },
        "hizmet_finans_danismanlik": {
            "positive": [
                "finans", "finance", "danismanlik", "consulting", "banka",
                "bank", "sigorta", "insurance", "muhasebe", "denetim",
                "audit", "yatirim", "investment", "treasury", "risk",
            ],
            "negative": ["food", "pharma", "otomotiv", "manufacturing"],
        },
        "eticaret_perakende_fmcg": {
            "positive": [
                "e-ticaret", "ecommerce", "perakende", "retail", "fmcg",
                "hizli tuketim", "consumer goods", "marketing",
                "category", "brand", "merchandising",
            ],
            "negative": ["banka", "pharma", "savunma", "automotive"],
        },
        "savunma_havacilik_enerji": {
            "positive": [
                "savunma", "defence", "defense", "havacilik", "aerospace",
                "enerji", "energy", "nukleer", "yenilenebilir", "aviation",
                "space", "aircraft",
            ],
            "negative": ["retail", "bank", "pharma"],
        },
        "gida_kimya_saglik": {
            "positive": [
                "gida", "food", "kimya", "chemistry", "saglik", "health",
                "ilac", "pharma", "biyoteknoloji", "biotech",
                "laboratuvar", "laboratory", "lab", "medikal",
                "hastane", "hospital", "klinik", "clinical",
            ],
            "negative": ["banka", "software", "otomotiv", "automotive"],
        },
        "lojistik_tasimacilık": {
            "positive": [
                "lojistik", "logistics", "tasimacilik", "nakliye", "depo",
                "warehouse", "freight", "gumruk", "kargo", "dagitim",
                "teslimat", "shipment", "supply chain",
            ],
            "negative": ["pharma", "bank", "software"],
        },
        "tekstil_moda": {
            "positive": [
                "tekstil", "textile", "moda", "fashion", "kumas",
                "konfeksiyon", "giyim", "iplik", "apparel",
            ],
            "negative": ["bank", "software", "pharma"],
        },
        "insaat_yapi_malzemeleri": {
            "positive": [
                "insaat", "construction", "yapi", "bina", "altyapi",
                "infrastructure", "beton", "cimento", "seramik", "tesisat",
            ],
            "negative": ["bank", "software", "pharma"],
        },
    }

    COMPANY_SECTOR_HINTS = {
        "imalat_metal_makine": [
            "borusan holding", "bsh ev aletleri", "b/s/h", "bsh turkiye",
            "schneider electric", "sisecam", "kordsa", "beko", "arcelik",
            "vestel", "koc holding", "zorlu holding", "dogan holding",
            "oyak maden", "oyak maden metalurji", "bias muhendislik",
            "golgeart", "ermetal", "oerlikon", "sandvik", "trumpf",
            "bilkent holding", "assan aluminyum", "assan panel",
            "eaton", "eaton turkiye", "signify", "philips lighting",
            "abb", "abb turkiye", "emerson", "parker hannifin",
            "smc corporation", "norgren", "festo", "igus",
        ],
        "otomotiv_yan_sanayi": [
            "borusan otomotiv", "toyota turkiye", "bosch", "turktraktor",
            "mercedes-benz otomotiv", "mercedes benz otomotiv", "tofas",
            "togg", "otokoc otomotiv", "ford otosan", "otokar",
            "mercedes-benz turk", "mercedes benz turk", "oyak-renault",
            "oyak renault", "dogus otomotiv", "volkswagen", "seat", "porsche",
            "prometeon", "continental", "faurecia", "denso", "brembo",
            "trelleborg", "magna international", "mann+hummel", "mann hummel",
            "teklas", "valeo", "knorr-bremse", "knorr bremse",
            "goodyear", "goodyear tire", "autoliv", "phinia",
            "borgwarner", "schaeffler", "zf friedrichshafen", "zf turkey",
            "hella", "mahle", "plastic omnium",
        ],
        "yazilim_bilisim_teknoloji": [
            "turk telekom grubu", "turk telekom", "amazon", "softtech", "sap",
            "microsoft", "vodafone", "paribu", "oracle", "intel", "hepsiburada",
            "hepsiburada.com", "sahibinden", "sahibinden.com", "ibm",
            "turkcell", "huawei", "getir", "trendyol", "google", "apple",
            "samsung", "iyzico", "garanti bbva teknoloji", "intertech",
            "yemeksepeti", "yemeksepeti.com", "logo yazilim", "karel",
            "i2i systems", "medianova", "coderspace", "epam", "epam turkiye",
            "akakce", "ciceksepeti", "gratis", "n11", "teknosa",
            "turkcell teknoloji", "fibabanka teknoloji",
        ],
        "hizmet_finans_danismanlik": [
            "kiwa", "kiwa turkiye", "bureau veritas", "tuv sud", "tuv nord",
            "intertek", "sgs turkiye", "sgs group",
            "kuveyt turk katilim bankasi", "kpmg", "ing", "mckinsey",
            "mckinsey & company", "turkiye is bankasi", "is bankasi",
            "boston consulting group", "bcg", "hsbc", "garanti bbva",
            "turkiye finans katilim bankasi", "ziraat bankasi", "teb",
            "teb bnp paribas", "yapi kredi bankasi", "yapi kredi",
            "pwc", "pricewaterhousecoopers", "deloitte", "fiba grubu",
            "turkiye sigorta", "allianz", "qnb", "halkbank", "denizbank",
            "akbank", "ey", "ernst & young", "merkez bankasi",
            "sompo", "sompo sigorta", "axa sigorta", "mapfre sigorta",
            "bupa acibadem", "halk sigorta", "zurich sigorta", "metlife",
            "aviva", "euler hermes", "marsh", "coface",
            "token finansal", "papara", "ininal", "fibabanka",
            "odea bank", "burgan bank", "alternatifbank",
        ],
        "eticaret_perakende_fmcg": [
            "migros", "turk tuborg", "boyner", "eti", "mey diageo",
            "diageo turkiye", "procter & gamble", "procter gamble", "p&g",
            "colgate-palmolive", "colgate palmolive", "philip morris turkey",
            "h&m", "pernod ricard", "ikea", "metro turkiye", "mavi",
            "l'oreal", "loreal", "red bull", "yildiz holding",
            "anadolu grubu", "mondelez international", "mondelez",
            "unilever", "starbucks", "danone", "lc waikiki",
            "the coca-cola company", "coca-cola company", "pepsico",
            "british american tobacco", "bat", "anadolu efes", "jti",
            "japan tobacco international", "pladis", "ulker",
            "coca-cola icecek", "coca cola icecek", "cci", "nestle", "penti",
            "hayat kimya", "tchibo", "kraft heinz", "beiersdorf", "nivea",
            "reckitt", "henkel", "kao", "sc johnson",
        ],
        "savunma_havacilik_enerji": [
            "tei", "tusas engine", "turk havacilik ve uzay sanayii", "tusas", "fnss", "stm",
            "baykar", "aselsan", "havelsan", "roketsan", "pegasus",
            "turk hava yollari", "thy", "tav havalimanlari", "enerjisa enerji",
            "enerjisa", "petrol ofisi", "siemens", "socar turkiye",
            "tupras", "kale grubu", "tubitak", "cotesa", "mkek",
            "sstek", "isbir elektrik", "aygaz", "botas",
            "alstom", "alstom turkiye", "shell", "shell turkiye",
            "altinay", "altinay savunma", "aramco", "saudi aramco",
            "ge aviation", "rolls-royce", "rolls royce", "safran",
            "thales", "leonardo", "airbus", "boeing", "honeywell",
        ],
        "gida_kimya_saglik": [
            "sanofi", "johnson & johnson", "johnson johnson", "abdi ibrahim",
            "novartis", "bilim ilac", "pfizer", "astrazeneca",
            "bayer", "nobel ilac", "roche", "dimes", "boston scientific",
            "medtronic", "abbvie", "merck", "eczacibasi ilac",
            "biofarma", "santa farma", "onko ilac", "koçak farma",
            "kocak farma", "sanovel", "deva holding", "bio farma",
            "bimed", "bimed teknik", "biomet", "stryker", "zimmer",
            "becton dickinson", "bd medical", "fresenius", "baxter",
            "abbvie turkiye", "eli lilly", "lilly turkiye",
        ],
        "lojistik_tasimacilık": [
            "dhl group", "dhl supply chain", "dhl express",
            "ups", "fedex", "geodis", "ceva logistics",
            "db schenker", "kuehne nagel", "kuhne nagel", "maersk",
            "aramex", "yurtici kargo", "mng kargo", "borsa istanbul",
            "ekol lojistik", "horoz lojistik", "ntv lojistik",
        ],
        "tekstil_moda": [
            "penti", "koton", "defacto", "zara turkiye", "lcw",
            "lc waikiki tekstil", "bershka", "pull and bear",
            "kiğılı", "kigili", "altinyildiz", "pierre cardin",
            "ipekyol", "vakko", "adl group", "orka group",
        ],
        "insaat_yapi_malzemeleri": [
            "cimsa", "eczacibasi toplulugu", "eczacibasi yapi",
            "lafarge", "vitra", "kaleseramik", "seranit",
            "dogus insaat", "limak holding", "kalyon insaat",
            "ic insaat", "enka insaat", "ant yapi", "yapi merkezi",
            "tekfen insaat",
        ],
    }

    SECTOR_SCORE_WEIGHTS = {
        "title_positive": 5,
        "company_positive": 3,
        "description_positive": 1,
        "company_hint": 8,
        "title_company_hint": 4,
        "title_negative": -4,
        "company_negative": -3,
        "description_negative": -2,
    }

    SOURCE_WEIGHT_ADJUSTMENTS = {
        "linkedin": {"title_positive": 6, "description_positive": 1, "company_positive": 3},
        "youthall": {"title_positive": 4, "description_positive": 2, "company_positive": 3},
        "anbea": {"title_positive": 4, "description_positive": 2, "company_positive": 3},
        "boomerang": {"title_positive": 5, "description_positive": 2, "company_positive": 3},
        "toptalent": {"title_positive": 5, "description_positive": 2, "company_positive": 3},
        "odtu_kpm": {"title_positive": 4, "description_positive": 3, "company_positive": 3},
        "bogazici_km": {"title_positive": 4, "description_positive": 3, "company_positive": 3},
        "ytu_orkam": {"title_positive": 4, "description_positive": 3, "company_positive": 3},
        "itu_kariyer": {"title_positive": 3, "description_positive": 3, "company_positive": 4},
        "kariyer": {"title_positive": 5, "description_positive": 1, "company_positive": 3},
        "savunma": {"title_positive": 6, "description_positive": 2, "company_positive": 4},
    }

    KNOWN_TURKISH_COMPANIES = [
        "ford otosan", "tofas", "arcelik", "vestel", "turk telekom",
        "turkcell", "bim", "migros", "sabanci", "koc", "enka", "tekfen",
        "aselsan", "roketsan", "havelsan", "tubitak", "baykar", "tusas",
        "otokar", "temsa", "logo yazilim", "karel", "zorlu", "ekol",
    ]

    TURKIYE_LOCATION_KEYWORDS = [
        "turkiye", "turkey", "istanbul", "ankara", "izmir", "bursa", "kocaeli",
        "gebze", "sakarya", "eskisehir", "antalya", "konya", "tekirdag",
        "manisa", "denizli", "adana", "mersin", "kayseri", "gaziantep",
        "balikesir", "samsun", "trabzon", "edirne", "corlu", "yalova",
        "izmit", "pendik", "tuzla", "kartal", "umraniye", "maltepe",
        "dudullu", "dilovasi", "cayirova", "aliaga", "bornova", "torbali",
        "eyup", "levent", "maslak", "besiktas", "sisli", "bakirkoy",
        "atasehir", "kagithane", "arnavutkoy", "sariyer",
    ]

    FOREIGN_LOCATION_KEYWORDS = [
        "united states", "birlesik devletler", "abd", "u.s.", "usa",
        "germany", "almanya", "poland", "hollanda", "netherlands",
        "france", "italy", "spain", "uk", "united kingdom", "ingiltere",
        "canada", "mexico", "india", "romania", "czechia", "slovakia",
        "hungary", "belgium", "austria", "switzerland", "portugal",
        "pennsylvania", "cranberry township", "new york", "london",
        "berlin", "paris", "milan", "warsaw", "bucharest", "prague",
    ]

    REMOTE_LOCATION_KEYWORDS = [
        "remote", "uzaktan", "hybrid", "hibrit",
    ]

    PROGRAM_TYPE_RULES = {
        "yaz_staj_programi": ["yaz ", "summer", "yaz staj", "yaz donemi"],
        "rotasyon": ["rotasyon", "rotation"],
        "graduate_program": ["graduate", "mezun", "yeni mezun"],
        "akademi_bootcamp": ["akademi", "bootcamp", "camp", "okulu"],
    }

    TR_CHAR_MAP = str.maketrans({
        "c": "c",
        "C": "c",
        "g": "g",
        "G": "g",
        "i": "i",
        "I": "i",
        "o": "o",
        "O": "o",
        "s": "s",
        "S": "s",
        "u": "u",
        "U": "u",
        "ç": "c",
        "Ç": "c",
        "ğ": "g",
        "Ğ": "g",
        "ı": "i",
        "İ": "i",
        "ö": "o",
        "Ö": "o",
        "ş": "s",
        "Ş": "s",
        "ü": "u",
        "Ü": "u",
    })

    def normalize_turkish(self, text: str) -> str:
        if not text:
            return ""
        text = str(text).translate(self.TR_CHAR_MAP).lower()
        text = unicodedata.normalize("NFKD", text)
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        return re.sub(r"\s+", " ", text).strip()

    def clean_text(self, text: str) -> str:
        if not text:
            return ""
        text = re.sub(r"<[^>]+>", " ", text)
        text = text.replace("\xa0", " ")
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    LOCATION_CANONICAL_MAP: tuple[tuple[str, str], ...] = (
        ("istanbul",    "İstanbul"),
        ("izmir",       "İzmir"),
        ("ankara",      "Ankara"),
        ("bursa",       "Bursa"),
        ("kocaeli",     "Kocaeli"),
        ("gebze",       "Kocaeli"),
        ("izmit",       "Kocaeli"),
        ("antalya",     "Antalya"),
        ("eskisehir",   "Eskişehir"),
        ("konya",       "Konya"),
        ("mersin",      "Mersin"),
        ("gaziantep",   "Gaziantep"),
        ("adana",       "Adana"),
        ("kayseri",     "Kayseri"),
        ("denizli",     "Denizli"),
        ("samsun",      "Samsun"),
        ("trabzon",     "Trabzon"),
        # Istanbul districts
        ("sisli",       "İstanbul"),
        ("kadikoy",     "İstanbul"),
        ("besiktas",    "İstanbul"),
        ("levent",      "İstanbul"),
        ("maslak",      "İstanbul"),
        ("atasehir",    "İstanbul"),
        ("kartal",      "İstanbul"),
        ("tuzla",       "İstanbul"),
        ("pendik",      "İstanbul"),
        ("sariyer",     "İstanbul"),
        ("umraniye",    "İstanbul"),
        ("maltepe",     "İstanbul"),
        # Remote / hybrid
        ("uzak",        "Uzak"),
        ("remote",      "Uzak"),
        ("home office", "Uzak"),
        ("uzaktan",     "Uzak"),
        ("hibrit",      "Hibrit"),
        ("hybrid",      "Hibrit"),
    )

    def normalize_location(self, raw: str) -> str:
        text = self.clean_text(raw or "")
        if not text:
            return "Türkiye"
        norm = self.normalize_turkish(text)
        for prefix, canonical in self.LOCATION_CANONICAL_MAP:
            if prefix in norm:
                return canonical
        return "Türkiye"

    def contains_any_keyword(self, text: str, keywords: list[str]) -> bool:
        normalized = self.normalize_turkish(text or "")
        return any(self.normalize_turkish(keyword) in normalized for keyword in keywords)

    def is_turkiye_location(self, location: str) -> bool:
        normalized = self.normalize_turkish(self.normalize_location(location))
        if not normalized:
            return False
        if any(keyword in normalized for keyword in self.FOREIGN_LOCATION_KEYWORDS):
            return False
        return any(keyword in normalized for keyword in self.TURKIYE_LOCATION_KEYWORDS)

    def is_remote_or_hybrid_location(self, location: str) -> bool:
        return self.contains_any_keyword(self.normalize_location(location), self.REMOTE_LOCATION_KEYWORDS)

    def has_turkiye_context(self, location: str, description: str = "", company_name: str = "") -> bool:
        if self.is_turkiye_location(location):
            return True

        normalized_description = self.normalize_turkish(description or "")
        normalized_company = self.normalize_turkish(company_name or "")
        company_hints = set(self.KNOWN_TURKISH_COMPANIES)
        for hints in self.COMPANY_SECTOR_HINTS.values():
            company_hints.update(hints)

        has_turkiye_keyword = any(keyword in normalized_description for keyword in self.TURKIYE_LOCATION_KEYWORDS)
        has_known_turkish_company = any(
            self.normalize_turkish(company_hint) in normalized_company
            for company_hint in company_hints
        )

        if has_turkiye_keyword or has_known_turkish_company:
            return True

        if any(keyword in normalized_description for keyword in self.FOREIGN_LOCATION_KEYWORDS):
            return False

        return False

    def filter_by_keywords(self, title: str, description: str) -> bool:
        norm_title = self.normalize_turkish(title or "")
        norm_desc = self.normalize_turkish(description or "")

        # Tier-1: güçlü EM sinyali — title veya description'da yeterli
        for kw in self.STRONG_EM_KEYWORDS:
            nkw = self.normalize_turkish(kw)
            if nkw in norm_title or nkw in norm_desc:
                return True

        # Tier-2: genel endüstri terimi — yalnızca title'da geçiyorsa kabul et
        for kw in self.TITLE_ONLY_EM_KEYWORDS:
            if self.normalize_turkish(kw) in norm_title:
                return True

        return False

    def targets_associate_degree(self, title: str, description: str) -> bool:
        text = self.normalize_turkish(f"{title} {description}")
        associate_keywords = [
            "onlisans", "on lisans", "associate degree", "vocational school",
            "meslek yuksekokulu", "meslek yuksek okulu", "myo", "2 yillik", "iki yillik",
        ]
        bachelor_keywords = [
            "lisans", "4 yillik", "dort yillik", "undergraduate", "bachelor",
            "muhendislik", "3. sinif", "4. sinif", "universite ogrencisi",
        ]
        has_associate_signal = any(keyword in text for keyword in associate_keywords)
        has_bachelor_signal = any(keyword in text for keyword in bachelor_keywords)
        return has_associate_signal and not has_bachelor_signal

    def get_sector_classification(
        self,
        title: str,
        description: str,
        company_name: str = "",
        source_platform: str = "",
    ) -> dict:
        normalized_title = self.normalize_turkish(title or "")
        normalized_description = self.normalize_turkish(description or "")
        normalized_company = self.normalize_turkish(company_name or "")
        weights = {**self.SECTOR_SCORE_WEIGHTS, **self.SOURCE_WEIGHT_ADJUSTMENTS.get(source_platform, {})}

        scores = {}
        sector_signals = {}

        for sector, rules in self.EM_SECTOR_RULES.items():
            score = 0
            signals = {
                "title_positive_hits": 0,
                "company_positive_hits": 0,
                "description_positive_hits": 0,
                "company_hint_hits": 0,
            }

            for keyword in rules.get("positive", []):
                normalized_keyword = self.normalize_turkish(keyword)
                if normalized_keyword in normalized_title:
                    score += weights["title_positive"]
                    signals["title_positive_hits"] += 1
                if normalized_keyword in normalized_company:
                    score += weights["company_positive"]
                    signals["company_positive_hits"] += 1
                if normalized_keyword in normalized_description:
                    score += weights["description_positive"]
                    signals["description_positive_hits"] += 1

            for keyword in rules.get("negative", []):
                normalized_keyword = self.normalize_turkish(keyword)
                if normalized_keyword in normalized_title:
                    score += weights["title_negative"]
                if normalized_keyword in normalized_company:
                    score += weights["company_negative"]
                if normalized_keyword in normalized_description:
                    score += weights["description_negative"]

            for company_hint in self.COMPANY_SECTOR_HINTS.get(sector, []):
                normalized_hint = self.normalize_turkish(company_hint)
                if normalized_hint in normalized_company:
                    score += weights["company_hint"]
                    signals["company_hint_hits"] += 1
                elif normalized_hint in normalized_title:
                    score += weights["title_company_hint"]

            scores[sector] = score
            sector_signals[sector] = signals

        if not scores:
            return {"primary": "diger", "secondary": None, "confidence": 0.0, "scores": {}}

        best_sector, best_score = max(scores.items(), key=lambda item: item[1])
        sorted_scores = sorted(scores.values(), reverse=True)
        second_best_score = sorted_scores[1] if len(sorted_scores) > 1 else 0
        second_sector = None
        if len(sorted_scores) > 1:
            for sector, score in scores.items():
                if sector != best_sector and score == second_best_score:
                    second_sector = sector
                    break

        confidence = 0.0
        if best_score > 0:
            confidence = round(
                max(0.0, min(100.0, ((best_score - second_best_score) / max(best_score, 1)) * 100)),
                2,
            )

        primary = best_sector
        secondary = second_sector if second_sector and second_best_score >= 2 else None
        best_signals = sector_signals.get(best_sector, {})
        
        # More inclusive classification:
        # - Title match alone is strong evidence
        # - Company hints are strong indicators
        # - 2+ description hits indicate relevant sector
        # - Only default to "diger" if no signals at all (score = 0)
        has_title_signal = best_signals.get("title_positive_hits", 0) > 0
        has_company_hint = best_signals.get("company_hint_hits", 0) > 0
        has_multiple_description_hits = best_signals.get("description_positive_hits", 0) >= 2
        has_meaningful_signal = best_score >= 1  # More inclusive: even 1 point is meaningful
        
        # Only use "diger" if genuinely no signals (score=0) or extremely weak/ambiguous
        # Don't use "diger" if we have:
        # - Title keyword match, OR
        # - Company hint, OR
        # - Multiple description matches
        if best_score == 0:
            # No signals at all
            primary = "diger"
            secondary = None
        elif has_title_signal or has_company_hint or has_multiple_description_hits:
            # Strong indicator - keep the primary sector
            primary = best_sector
            secondary = second_sector if second_sector and second_best_score >= 1 else None
        elif best_score >= 3:
            # Reasonable score - keep the primary sector
            primary = best_sector
            secondary = second_sector if second_sector and second_best_score >= 1 else None
        else:
            # Very weak signal - only use "diger" if confidence is extremely low
            # This prevents the catch-all from capturing real EM positions
            primary = best_sector if best_score > 0 else "diger"
            secondary = None

        return {
            "primary": primary,
            "secondary": secondary if primary != secondary else None,
            "confidence": confidence,
            "scores": scores,
        }

    def detect_em_focus_area(
        self,
        title: str,
        description: str,
        company_name: str = "",
        source_platform: str = "",
    ) -> str:
        return self.get_sector_classification(title, description, company_name, source_platform)["primary"]

    def detect_company_origin(self, company_name: str) -> str:
        name = self.normalize_turkish(company_name)
        if any(self.normalize_turkish(c) in name for c in self.KNOWN_TURKISH_COMPANIES):
            return "yerli"
        return "yabanci"

    def detect_internship_type(self, title: str, description: str) -> str:
        text = self.normalize_turkish(f"{title} {description}")
        if any(kw in text for kw in ["zorunlu staj", "staj 1", "staj 2", "uretim staji", "yonetim staji", "sgk"]):
            return "zorunlu"
        if any(kw in text for kw in ["gonullu", "part time", "yari zamanli"]):
            return "gonullu"
        return "belirsiz"

    def detect_program_type(self, title: str, description: str) -> Optional[str]:
        text = self.normalize_turkish(f"{title} {description}")
        for prog_type, keywords in self.PROGRAM_TYPE_RULES.items():
            if any(kw in text for kw in keywords):
                return prog_type
        return "kariyer_baslangic"

    TR_MONTHS = {
        "ocak": 1, "subat": 2, "mart": 3, "nisan": 4,
        "mayis": 5, "haziran": 6, "temmuz": 7, "agustos": 8,
        "eylul": 9, "ekim": 10, "kasim": 11, "aralik": 12,
    }
    EN_MONTHS = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
    }

    def parse_deadline(self, raw: Optional[str]) -> Optional[date]:
        """
        Tarihi DB'ye kaydetmek için parse eder. Geçmiş tarihler de saklanır;
        deadline_status compute_deadline_status() tarafından 'expired' olarak
        işaretlenir ve public queryset'ten gizlenir.
        """
        return parse_deadline_string(raw, allow_past=True)

    def compute_deadline_status(self, deadline: Optional[date]) -> str:
        if deadline is None:
            return "unknown"
        today = date.today()
        if deadline < today:
            return "expired"
        if deadline <= today + timedelta(days=7):
            return "urgent"
        return "normal"
