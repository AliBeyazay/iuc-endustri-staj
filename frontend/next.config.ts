import type { NextConfig } from 'next'

function normalizeBackendApiBaseUrl(value?: string) {
  const fallback = 'http://backend:8000/api'
  const trimmed = (value || fallback).replace(/\/$/, '')
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

const backendApiBaseUrl = normalizeBackendApiBaseUrl(
  process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL,
)

const nextConfig: NextConfig = {
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
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: `${backendApiBaseUrl}/:path*`,
      },
    ]
  },
}

export default nextConfig
