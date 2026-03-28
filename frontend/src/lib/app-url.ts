/**
 * Get the app's public URL for generating shareable links.
 * 
 * Priority:
 * 1. VITE_APP_URL - explicit app URL for shareable links
 * 2. VITE_WEBAPP_URL - fallback to webapp URL
 * 3. window.location.origin - fallback to current origin
 * 
 * @returns The base URL for the application (without trailing slash)
 */
export function getAppUrl(): string {
  const appUrl = import.meta.env.VITE_APP_URL || 
                 import.meta.env.VITE_WEBAPP_URL || 
                 window.location.origin
  
  // Remove trailing slash if present
  return appUrl.replace(/\/$/, '')
}
