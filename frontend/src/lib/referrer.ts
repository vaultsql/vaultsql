const REFERRER_COOKIE_KEY = 'vaultsql_referrer'
const COOKIE_MAX_AGE_DAYS = 30

/**
 * Set the referrer cookie from URL query parameter
 * Call this on signup/login pages when ?ref= is present
 */
export function setReferrerFromUrl(searchParams: URLSearchParams): void {
  const ref = searchParams.get('ref')
  if (ref) {
    setReferrerCookie(ref)
  }
}

/**
 * Set the referrer cookie with a value
 */
export function setReferrerCookie(referrer: string): void {
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 // 30 days in seconds
  document.cookie = `${REFERRER_COOKIE_KEY}=${encodeURIComponent(referrer)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

/**
 * Get the referrer from cookie
 */
export function getReferrerCookie(): string | null {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=')
    if (key === REFERRER_COOKIE_KEY) {
      return value ? decodeURIComponent(value) : null
    }
  }
  return null
}

/**
 * Clear the referrer cookie
 * Call this after successfully creating a workspace
 */
export function clearReferrerCookie(): void {
  document.cookie = `${REFERRER_COOKIE_KEY}=; path=/; max-age=0`
}
