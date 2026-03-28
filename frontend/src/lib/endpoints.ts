// Default URLs for development
const DEFAULT_API_URL = 'http://localhost:8000'
const DEFAULT_QUERY_SERVICE_URL = '/query'

// Production URLs
export const PROD_API_URL = 'https://app.vaultsql.com'
export const PROD_QUERY_SERVICE_URL = 'https://app.vaultsql.com/query'
export const PROD_WEBAPP_URL = 'https://app.vaultsql.com'

// Environment variable overrides
const ENV_API_URL = import.meta.env.VITE_API_URL as string | undefined

/**
 * Get the API URL (Django backend).
 * Priority: Environment variable > Default
 */
export async function getApiUrl(): Promise<string> {
  return ENV_API_URL || DEFAULT_API_URL
}

/**
 * Get the Query Service URL (Go query service).
 * Uses relative path /query (proxied by Caddy in production)
 */
export async function getQueryServiceUrl(): Promise<string> {
  return DEFAULT_QUERY_SERVICE_URL
}
