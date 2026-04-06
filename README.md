# İÜC Staj Platformu

İstanbul Üniversitesi-Cerrahpaşa Endüstri Mühendisliği öğrencilerine özel staj platformu.

## Proje Yapısı

```
iuc-staj/
├── backend/          # Django + DRF + Scrapy + Celery
├── frontend/         # Next.js 15 + TypeScript + Tailwind
└── docker-compose.yml
```

## Hızlı Başlangıç (Docker)

```bash
# 1. Repoyu klonla
git clone <repo-url>
cd iuc-staj

# 2. Env dosyalarını oluştur
cp backend/.env.example backend/.env       # değerleri doldur
cp frontend/.env.example frontend/.env.local  # değerleri doldur

# 3. Servisleri başlat
docker compose up -d

# 4. Migrasyonları çalıştır
docker compose exec backend python manage.py migrate

# 5. Admin kullanıcısı oluştur
docker compose exec backend python manage.py createsuperuser

# 6. Playwright chromium yükle (ilk kurulumda)
docker compose exec backend playwright install chromium --with-deps
```

Erişim:
- Frontend → http://localhost:3000
- Backend API → http://localhost:8000/api
- Django Admin → http://localhost:8000/admin

---

## GitHub Codespaces ile Çalıştırma

Docker kurulumuna gerek kalmadan bulutta geliştirme ortamı oluşturmak için:

1. **GitHub'da Repo Oluştur**: Bu projeyi GitHub'a yükle
2. **Codespaces Aç**: Repo sayfasında "Code" → "Codespaces" → "Create codespace on main"
3. **Otomatik Kurulum**: VS Code web arayüzünde açılır ve tüm servisler otomatik başlar
4. **İlk Kurulum Adımları**:
   ```bash
   # Terminal'de (otomatik açılır)
   cd backend
   python manage.py migrate
   python manage.py createsuperuser
   playwright install chromium
   ```

Erişim:
- Frontend → https://[codespace-name]-3000.githubpreview.dev
- Backend API → https://[codespace-name]-8000.githubpreview.dev/api
- Django Admin → https://[codespace-name]-8000.githubpreview.dev/admin

**Not**: Codespaces ücretsiz kullanım limiti vardır, uzun süreli kullanım için dikkatli olun.

---

## Manuel Kurulum

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium

# .env dosyasını düzenle
cp .env.example .env

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Celery (ayrı terminal):
```bash
celery -A config worker --loglevel=info
celery -A config beat   --loglevel=info
```

Beat schedule veritabanını deploy veya bakım sonrası hizalamak için:
```bash
python manage.py sync_celery_beat
```

### Frontend

```bash
cd frontend
npm install

# .env.local dosyasını düzenle
cp .env.example .env.local

npm run dev
```

---

## Scraper'ı Manuel Tetikleme

Django Admin → Scraper Logs → "Run Spider" aksiyonu  
**veya** doğrudan:

```bash
# Tek spider
docker compose exec celery python -m scrapy crawl linkedin

# Tüm spider'lar (Celery task)
docker compose exec backend python manage.py shell -c "
from apps.scraper.tasks import run_all_scrapers
run_all_scrapers.delay()
"
```

Beat tarafında aktif toplu görev:
`all-scrape` -> `apps.scraper.tasks.run_all_scrapers` -> `02:00 Europe/Istanbul`

---

## Ortam Değişkenleri

### backend/.env
| Değişken | Açıklama |
|---|---|
| `SECRET_KEY` | Django secret key (`openssl rand -base64 50`) |
| `DEBUG` | `True` geliştirme, `False` üretim |
| `DB_NAME` | PostgreSQL veritabanı adı |
| `DB_USER` | PostgreSQL kullanıcı adı |
| `DB_PASSWORD` | PostgreSQL şifresi |
| `REDIS_URL` | Redis bağlantı URL'i |
| `EMAIL_HOST_USER` | Gmail adresi (OTP için) |
| `EMAIL_HOST_PASSWORD` | Gmail uygulama şifresi |
| `FRONTEND_URL` | Frontend URL (şifre sıfırlama linki için) |

### frontend/.env.local
| Değişken | Açıklama |
|---|---|
| `NEXT_PUBLIC_API_URL` | Django API base URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Frontend URL |

---

## Tech Stack

| Katman | Teknoloji |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, NextAuth.js v5, SWR, React Hook Form, Zod |
| Backend | Django 5, Django REST Framework, SimpleJWT |
| Scraping | Scrapy 2.11, scrapy-playwright, Celery, Redis |
| Veritabanı | PostgreSQL 16 |
| DevOps | Docker Compose |

---

## API Endpointleri

| Method | URL | Açıklama |
|---|---|---|
| GET | `/api/listings/` | İlan listesi (filtreli, sayfalı) |
| GET | `/api/listings/:id/` | İlan detayı |
| GET | `/api/reviews/` | Değerlendirmeler |
| POST | `/api/reviews/` | Değerlendirme ekle |
| GET | `/api/bookmarks/` | Kaydedilen ilanlar |
| POST | `/api/bookmarks/` | İlan kaydet |
| DELETE | `/api/bookmarks/:id/` | Kaydı sil |
| GET | `/api/profile/` | Öğrenci profili |
| PATCH | `/api/profile/` | Profil güncelle |
| POST | `/api/profile/cv/` | CV yükle |
| GET | `/api/dashboard/stats/` | Dashboard istatistikleri |
| POST | `/api/auth/register/` | Kayıt ol |
| POST | `/api/auth/verify-otp/` | OTP doğrula |
| POST | `/api/auth/login/` | Giriş (JWT) |
| POST | `/api/auth/refresh/` | Token yenile |
 
---
 
## Environment Sync Notes
 
- Docker local development defaults to PostgreSQL through `backend/.env` with `USE_SQLITE=False`.
- Keep `APP_ENV=dev` in `backend/.env` so the Django admin runtime banner clearly shows the local environment.
- `frontend/.env.production` points to `https://iuc-staj-backend.onrender.com/api`.
- If Vercel defines `NEXT_PUBLIC_API_URL`, that platform value is the source of truth.
- Local admin affects the local site, production admin affects the production site.
 
### Production Deploy Checklist
 
1. Deploy backend changes.
2. Run Django migrations on the production backend.
3. Open Django admin and confirm the runtime banner shows `prod` and the expected database host.
4. Confirm the production frontend is pointing to the production backend URL.
5. Verify that a listing edited or deleted in production admin is reflected on the production site.
