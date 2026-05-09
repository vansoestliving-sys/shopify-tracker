const PRODUCTION_APP_URL = 'https://app.vansoestliving.nl'
const OLD_TRACKER_DOMAIN = 'tracker.vansoestliving.nl'

export function getReviewBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (!configuredUrl || configuredUrl.includes(OLD_TRACKER_DOMAIN)) {
    return PRODUCTION_APP_URL
  }
  return configuredUrl
}

export function buildReviewUrl(orderNumber: string | number | null | undefined, email: string) {
  return `${getReviewBaseUrl()}/review?order=${orderNumber || ''}&email=${encodeURIComponent(email)}`
}
