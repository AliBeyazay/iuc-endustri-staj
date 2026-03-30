import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getBackendApiBaseUrl } from '@/lib/backend-url'
import { Listing } from '@/types'
import ListingDetailClient from './ListingDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

const backendApiBaseUrl = getBackendApiBaseUrl()

const getListingById = cache(async (id: string): Promise<Listing | null> => {
  const response = await fetch(`${backendApiBaseUrl}/listings/${id}/`, {
    headers: {
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    next: { revalidate: 120 },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Ilan fetch hatasi: ${response.status}`)
  }

  return (await response.json()) as Listing
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const listing = await getListingById(id)

  if (!listing) {
    return {
      title: 'Ilan bulunamadi | IUC Staj',
      description: 'Ilan detay sayfasi bulunamadi.',
      robots: { index: false, follow: false },
    }
  }

  return {
    title: `${listing.title} | ${listing.company_name} | IUC Staj`,
    description: `${listing.company_name} staj ilaninin detaylari, basvuru bilgileri ve ogrenci degerlendirmeleri.`,
  }
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params
  const listing = await getListingById(id)

  if (!listing) {
    notFound()
  }

  return <ListingDetailClient listing={listing} />
}
