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
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? `https://${process.env.VERCEL_URL ?? 'iuc-endustri-staj.vercel.app'}`)
  .replace(/\/$/, '')

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

function buildMetaDescription(listing: Listing): string {
  const raw = (listing.description ?? '').replace(/\s+/g, ' ').trim()
  const shortened = raw.length > 180 ? `${raw.slice(0, 177)}...` : raw
  return (
    shortened ||
    `${listing.company_name} staj ilaninin detaylari, basvuru bilgileri ve ogrenci degerlendirmeleri.`
  )
}

function resolveOgImage(listing: Listing): string {
  if (listing.company_logo_url && /^https?:\/\//i.test(listing.company_logo_url)) {
    return listing.company_logo_url
  }
  return `${siteUrl}/logo.png`
}

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

  const title = `${listing.title} | ${listing.company_name} | IUC Staj`
  const description = buildMetaDescription(listing)
  const detailUrl = `${siteUrl}/listings/${listing.id}`
  const ogImage = resolveOgImage(listing)

  return {
    title,
    description,
    alternates: {
      canonical: detailUrl,
    },
    openGraph: {
      title,
      description,
      url: detailUrl,
      siteName: 'IUC Endustri Muhendisligi Staj Platformu',
      type: 'article',
      locale: 'tr_TR',
      images: [
        {
          url: ogImage,
          alt: `${listing.company_name} - ${listing.title}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
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
