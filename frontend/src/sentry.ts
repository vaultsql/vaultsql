import * as Sentry from '@sentry/react'

// Only initialize Sentry when explicitly enabled via environment variable
if (import.meta.env.VITE_ENABLE_SENTRY === 'true' && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    // Enable capturing of PII data (IP addresses, user data, etc.)
    sendDefaultPii: true,
    // Performance monitoring - sample 10% of transactions
    tracesSampleRate: 0.1,
    // Set environment
    environment: 'production',
    // Ignore common browser extension errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension://',
      'moz-extension://',
      // Random plugins/extensions
      "Can't find variable: ZiteReader",
      'jigsaw is not defined',
      'ComboSearch is not defined',
      // Network errors that are not actionable
      'NetworkError',
      'Network request failed',
      'Failed to fetch',
    ],
  })
}
