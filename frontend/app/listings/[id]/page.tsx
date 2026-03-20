import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchListingById } from '@/lib/api'
import ListingDetailClient from './ListingDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params
    const l = await fetchListingById(id)
    return {
      title: `${l.title} — ${l.company_name} | İÜC Staj`,
      description: l.description.slice(0, 150),
    }
  } catch {
    return { title: 'İlan Bulunamadı | İÜC Staj' }
  }
}

export default async function ListingDetailPage({ params }: Props) {
  let listing
  try {
    const { id } = await params
    listing = await fetchListingById(id)
  } catch {
    notFound()
  }
  return <ListingDetailClient listing={listing} />
}
