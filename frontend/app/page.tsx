import { redirect } from 'next/navigation'
import type { HomepageFeaturedListing } from '@/types'
import PublicSiteHeader from '@/components/PublicSiteHeader'
import FeaturedListingsSection from '@/components/home/FeaturedListingsSection'
import { loadHomepageFeaturedListings } from '@/lib/public-listings-source'

export const revalidate = 300

async function getHomepageFeaturedListings(): Promise<HomepageFeaturedListing[]> {
  const { data } = await loadHomepageFeaturedListings()
  return data
}

export default async function HomePage() {
  const featuredListings = await getHomepageFeaturedListings()

  if (!featuredListings.length) {
    redirect('/listings')
  }

  return (
    <div className="campus-shell min-h-screen">
      <PublicSiteHeader activePath="/" />

      <main className="pt-6 sm:pt-8">
        <div id="featured-listings">
          <FeaturedListingsSection listings={featuredListings} />
        </div>
      </main>
    </div>
  )
}
