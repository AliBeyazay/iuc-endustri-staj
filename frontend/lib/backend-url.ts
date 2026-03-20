function normalizeBaseUrl(value: string) {
  const trimmed = value.replace(/\/$/, '')
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

export function getBackendApiBaseUrl() {
  return normalizeBaseUrl(
    process.env.API_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.NEXT_PUBLIC_BACKEND_URL ??
      'http://backend:8000',
  )
}
