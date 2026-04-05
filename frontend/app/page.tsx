import { redirect } from 'next/navigation'
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
