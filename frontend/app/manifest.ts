import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IUC Endustri Muhendisligi Staj Platformu',
    short_name: 'IUC Staj',
    description: 'IUC Endustri Muhendisligi ogrencileri icin staj ve ilan platformu.',
    start_url: '/listings',
    display: 'standalone',
    background_color: '#0b1a2c',
    theme_color: '#132843',
    lang: 'tr',
    orientation: 'portrait',
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
