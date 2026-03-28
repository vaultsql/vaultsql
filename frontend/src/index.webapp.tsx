// Initialize Sentry first, before any other imports
import './sentry'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from 'posthog-js/react'

import './components/index.css'

import App from './webapp/App'

const posthogEnabled = import.meta.env.VITE_ENABLE_POSTHOG === 'true'
const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: '2025-11-30',
} as const

const AppWithProviders = posthogEnabled && posthogKey ? (
  <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
    <App />
  </PostHogProvider>
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{AppWithProviders}</StrictMode>,
)
