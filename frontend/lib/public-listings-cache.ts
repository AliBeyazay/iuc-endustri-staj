export const PUBLIC_LISTINGS_REVALIDATE_SECONDS = 300
export const PUBLIC_LISTINGS_REQUEST_TIMEOUT_MS = 5000
export const PUBLIC_LISTINGS_STALE_WHILE_REVALIDATE_SECONDS = 300

const publicCdnCacheControl =
  `s-maxage=${PUBLIC_LISTINGS_REVALIDATE_SECONDS}, ` +
  `stale-while-revalidate=${PUBLIC_LISTINGS_STALE_WHILE_REVALIDATE_SECONDS}`

export function buildPublicListingsCacheHeaders(contentType = 'application/json') {
  return {
    'Content-Type': contentType,
    'Cache-Control': `public, max-age=0, ${publicCdnCacheControl}`,
    'CDN-Cache-Control': publicCdnCacheControl,
    'Vercel-CDN-Cache-Control': publicCdnCacheControl,
  }
}
