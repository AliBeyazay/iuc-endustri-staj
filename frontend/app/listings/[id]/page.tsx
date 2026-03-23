import type { Metadata } from 'next'
import ListingDetailPageContent from './ListingDetailPageContent'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  return {
    title: `İlan Detayı #${id} | İÜC Staj`,
    description: 'İlan detayları, başvuru bilgileri ve öğrenci değerlendirmeleri.',
  }
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params
  return <ListingDetailPageContent id={id} />
}
