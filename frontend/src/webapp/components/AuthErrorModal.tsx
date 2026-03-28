import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog'
import { clearAuthToken } from '@/lib/auth'
import { clearVaultData } from '@/lib/vault'
import { setAuthErrorCallback } from '../App'

interface AuthErrorProviderProps {
  children: ReactNode
}

export function AuthErrorProvider({ children }: AuthErrorProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()

  const showAuthError = useCallback(() => {
    setIsOpen(true)
  }, [])

  useEffect(() => {
    setAuthErrorCallback(showAuthError)
    return () => {
      setAuthErrorCallback(() => {})
    }
  }, [showAuthError])

  const handleLogout = async () => {
    try {
      clearAuthToken()
      await clearVaultData()
      queryClient.clear()
    } catch (error) {
      console.error('Error during logout:', error)
    } finally {
      window.location.assign('/login')
    }
  }

  return (
    <>
      {children}
      <Dialog open={isOpen} onClose={() => {}}>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle>Session Error</DialogTitle>
        </div>
        <DialogDescription>
          We encountered an authentication error. Your session may have expired or been invalidated.
          Please log out and sign in again to continue.
        </DialogDescription>
        <DialogBody>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            If this issue persists after logging in again, please contact support.
          </p>
        </DialogBody>
        <DialogActions>
          <Button color="red" onClick={handleLogout}>
            Log Out
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// Helper to check if an error is an invalid token error
export function isInvalidTokenError(error: unknown): boolean {
  if (!error) return false

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : ''

  return message.toLowerCase().includes('invalid token')
}
