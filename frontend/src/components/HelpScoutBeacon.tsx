import { useEffect, useRef } from 'react'
import { useUser } from '@/queries/user'

declare global {
  interface Window {
    Beacon?: (method: string, ...args: unknown[]) => void
  }
}

// HelpScout Beacon ID - must match the one in index.html
const BEACON_ID = 'e252d20e-35a1-4903-bc21-e30fbfd133b3'

/**
 * Opens the HelpScout beacon widget.
 * Call this function when user clicks on support/contact buttons.
 */
export function openHelpScoutBeacon() {
  if (window.Beacon) {
    window.Beacon('open')
  }
}

/**
 * Closes the HelpScout beacon widget popup (but keeps the button visible).
 */
export function closeHelpScoutBeacon() {
  if (window.Beacon) {
    window.Beacon('close')
  }
}

/**
 * Completely hides the HelpScout beacon widget (destroys it).
 * Use showHelpScoutBeacon() to restore it.
 */
export function hideHelpScoutBeacon() {
  if (window.Beacon) {
    window.Beacon('destroy')
  }
}

/**
 * Shows the HelpScout beacon widget by re-initializing it.
 * Use after hideHelpScoutBeacon() to restore the beacon.
 */
export function showHelpScoutBeacon() {
  if (window.Beacon) {
    window.Beacon('init', BEACON_ID)
  }
}

/**
 * HelpScout Beacon user identification.
 *
 * The beacon script itself is loaded in index.html. This component only
 * handles identifying the user once they're logged in.
 */
export function HelpScoutBeacon() {
  const { data: user } = useUser()
  const identifiedRef = useRef(false)

  useEffect(() => {
    if (!window.Beacon || !user) {
      return
    }

    // Only identify once per component instance
    if (identifiedRef.current) {
      return
    }

    const identifyData: {
      name?: string
      email?: string
      company?: string
    } = {}

    if (user.user?.name) {
      identifyData.name = user.user.name
    }
    if (user.user?.email) {
      identifyData.email = user.user.email
    }
    if (user.workspace?.name) {
      identifyData.company = user.workspace.name
    }

    // Only identify if we have at least email or name
    if (identifyData.email || identifyData.name) {
      window.Beacon('identify', identifyData)
      identifiedRef.current = true
    }
  }, [user])

  return null
}
