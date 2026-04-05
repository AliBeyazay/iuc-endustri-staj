export function buildDefaultListingsApiQuery() {
  const searchParams = new URLSearchParams()
  searchParams.set('page', '1')
  searchParams.set('ordering', '-created_at')
  return searchParams.toString()
}

export function buildDefaultListingsSWRKey() {
  return `/api/listings?${buildDefaultListingsApiQuery()}`
}
