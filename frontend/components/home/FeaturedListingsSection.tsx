import Link from 'next/link'
import type { HomepageFeaturedListing } from '@/types'
import FeaturedListingCard from './FeaturedListingCard'

type FeaturedListingsSectionProps = {
  listings: HomepageFeaturedListing[]
}

export default function FeaturedListingsSection({ listings }: FeaturedListingsSectionProps) {
  if (!listings.length) {
    return null
  }

  return (
    <section className="px-4 pb-16 pt-4 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8f670b] dark:text-[#f0cf7a]">
              Editör Seçkisi
            </p>
            <h2 className="campus-heading mt-2 text-4xl leading-none text-[#132843] dark:text-[#f7fbff]">
              Öne Çıkan İlanlar
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#173156]/72 dark:text-[#e7edf4]/68">
              Yönetim panelinden seçtiğin ilanlar, ana sayfada bu vitrin alanında öne çıkar.
            </p>
          </div>
          <Link
            href="/listings"
            className="campus-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
          >
            Tüm İlanları Gör
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <FeaturedListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </div>
    </section>
  )
}
