const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

/**
 * Check if a string looks like HTML (e.g., Cloudflare error page)
 */
function looksLikeHtml(str: string): boolean {
  const trimmed = str.trim()
  return (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<HTML') ||
    trimmed.includes('<head>') ||
    trimmed.includes('<body>')
  )
}

/**
 * Check if a message is a reasonable user-facing error message.
 * Returns false for HTML, overly long messages, or gibberish.
 */
function isValidErrorMessage(message: string): boolean {
  if (!message || typeof message !== 'string') return false
  // Reject HTML responses
  if (looksLikeHtml(message)) return false
  // Reject overly long messages (likely stack traces or HTML)
  if (message.length > 500) return false
  // Reject messages that look like JSON objects
  if (message.startsWith('{') || message.startsWith('[')) return false
  return true
}

export function getErrorMessage(error: unknown): string {
  if (!error) return GENERIC_ERROR_MESSAGE

  if (typeof error === 'string') {
    return isValidErrorMessage(error) ? error : GENERIC_ERROR_MESSAGE
  }

  if (error instanceof Error) {
    // Network errors
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      return 'Unable to connect to the server. Please check your connection.'
    }
    return isValidErrorMessage(error.message) ? error.message : GENERIC_ERROR_MESSAGE
  }

  if (typeof error === 'object') {
    const maybeDetail = (error as { detail?: unknown }).detail
    if (maybeDetail && typeof maybeDetail === 'string' && isValidErrorMessage(maybeDetail)) {
      return maybeDetail
    }
    const maybeMessage = (error as { message?: unknown }).message
    if (maybeMessage && typeof maybeMessage === 'string' && isValidErrorMessage(maybeMessage)) {
      return maybeMessage
    }
    // Don't return JSON stringified errors to users
    return GENERIC_ERROR_MESSAGE
  }

  const stringified = String(error)
  return isValidErrorMessage(stringified) ? stringified : GENERIC_ERROR_MESSAGE
}
