import type { NextConfig } from 'next'

// /backend-api/* → Django backend proxy
// Docker: API_INTERNAL_URL=http://backend:8000/api, local: http://localhost:8000/api
function getBackendOrigin() {
  const internal = process.env.API_INTERNAL_URL ?? ''
  if (internal) return internal.replace(/\/api\/?$/, '')
  const pub = process.env.NEXT_PUBLIC_API_URL ?? ''
  if (pub && pub.startsWith('http')) return pub.replace(/\/api\/?$/, '')
  return 'http://localhost:8000'
}

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const backendOrigin = getBackendOrigin()
    return [
      {
        source: '/backend-api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ]
  },
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'media.licdn.com' },
      { protocol: 'https', hostname: 'static.licdn.com' },
      { protocol: 'https', hostname: 'savunmakariyer.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: '*.youthall.com' },
      { protocol: 'https', hostname: '*.boomerang.careers' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'www.google.com' },
      { protocol: 'https', hostname: '*.gstatic.com' },
      { protocol: 'https', hostname: 'logo.clearbit.com' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
}

export default nextConfig
