import Link from 'next/link'
import type { HomepageFeaturedListing } from '@/types'
import PublicSiteHeader from '@/components/PublicSiteHeader'
import FeaturedListingsSection from '@/components/home/FeaturedListingsSection'
import { getBackendApiBaseUrl } from '@/lib/backend-url'

export const dynamic = 'force-dynamic'

const backendApiBaseUrl = getBackendApiBaseUrl()

async function getHomepageFeaturedListings(): Promise<HomepageFeaturedListing[]> {
  try {
    const response = await fetch(`${backendApiBaseUrl}/homepage/featured-listings/`, {
      headers: {
        Accept: 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return []
    }

    return (await response.json()) as HomepageFeaturedListing[]
  } catch {
    return []
  }
}

export default async function HomePage() {
  const featuredListings = await getHomepageFeaturedListings()

  return (
    <div className="campus-shell min-h-screen">
      <PublicSiteHeader activePath="/" />

      <main>
        <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-center">
            <div className="relative overflow-hidden rounded-[36px] border border-white/12 bg-[linear-gradient(135deg,rgba(12,28,49,0.98),rgba(20,42,69,0.96)_55%,rgba(216,173,67,0.22))] px-6 py-8 text-white shadow-[0_30px_80px_rgba(7,16,28,0.28)] sm:px-10 sm:py-12">
              <div className="absolute -left-16 top-8 h-44 w-44 rounded-full border border-white/10 bg-white/5 blur-2xl" />
              <div className="absolute right-8 top-10 h-28 w-28 rounded-[28px] border border-[#d8ad43]/28 bg-[#d8ad43]/10 backdrop-blur-sm" />
              <div className="absolute bottom-0 right-0 h-52 w-52 bg-[radial-gradient(circle,_rgba(216,173,67,0.22),_transparent_60%)]" />

              <div className="relative z-10">
                <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[#f0cf7a]">
                  IUC Kariyer Vitrini
                </p>
                <h1 className="campus-heading mt-4 max-w-3xl text-4xl leading-[0.95] text-white sm:text-5xl lg:text-6xl">
                  Endüstri mühendisliği odaklı staj fırsatlarını daha hızlı keşfet.
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                  Youthall, LinkedIn, Kariyer.net ve diğer kaynaklardan çekilen ilanlar arasından
                  yönetim panelinde öne çıkardığın fırsatları ana sayfada vitrine taşı.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/listings"
                    className="campus-button-primary inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold uppercase tracking-[0.2em]"
                  >
                    İlanları Keşfet
                  </Link>
                  <a
                    href={featuredListings.length ? '#featured-listings' : '/listings'}
                    className="campus-button-secondary inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
                  >
                    {featuredListings.length ? 'Öne Çıkanlara Git' : 'Güncel İlanlara Git'}
                  </a>
                </div>
              </div>
            </div>

            <aside className="campus-card overflow-hidden rounded-[32px] border px-6 py-7 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8f670b] dark:text-[#f0cf7a]">
                Hızlı Bakış
              </p>
              <h2 className="campus-heading mt-3 text-3xl leading-none text-[#132843] dark:text-[#f7fbff]">
                Ana sayfa vitrin alanı hazır
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#173156]/72 dark:text-[#e7edf4]/68">
                Django admin üzerinden seçtiğin en fazla 3 ilan, görsel kart düzeniyle burada yer alır.
                Karttan detay sayfasına gidilir, detaylardan da tam ilan akışına bağlanılır.
              </p>

              <div className="mt-8 grid gap-3">
                {[
                  `${featuredListings.length} öne çıkan ilan yayınlanıyor`,
                  'Sıralama admin rank değerine göre geliyor',
                  'Görsel yoksa marka renklerine göre fallback banner üretiliyor',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[#d8ad43]/14 bg-white/72 px-4 py-3 text-sm font-medium text-[#173156] dark:border-[#d8ad43]/16 dark:bg-white/6 dark:text-[#e7edf4]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        {featuredListings.length > 0 && (
          <div id="featured-listings">
            <FeaturedListingsSection listings={featuredListings} />
          </div>
        )}

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-7xl rounded-[32px] border border-[#d8ad43]/14 bg-[linear-gradient(135deg,rgba(255,250,240,0.96),rgba(255,255,255,0.72))] px-6 py-8 shadow-[0_24px_60px_rgba(10,21,35,0.08)] dark:border-[#d8ad43]/14 dark:bg-[linear-gradient(135deg,rgba(18,36,58,0.96),rgba(14,30,51,0.92))] sm:px-10 sm:py-10">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8f670b] dark:text-[#f0cf7a]">
                  Tam Listeye Geç
                </p>
                <h2 className="campus-heading mt-2 text-3xl leading-none text-[#132843] dark:text-[#f7fbff]">
                  Tüm ilan akışını tek ekranda takip et
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#173156]/72 dark:text-[#e7edf4]/68">
                  Filtreleme, arama ve detay sayfası deneyimi için tam ilan listesine geçebilir,
                  güncel staj ve yetenek programlarını tek yerde inceleyebilirsin.
                </p>
              </div>
              <Link
                href="/listings"
                className="campus-button-primary inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold uppercase tracking-[0.2em]"
              >
                Tüm İlanları Gör
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
