import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/components/catalyst/auth-layout'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Strong, Text, TextLink } from '@/components/catalyst/text'
import { setAuthToken } from '@/lib/auth'
import { clearGoogleAuthContext, completeGoogleAuth, getGoogleAuthContext } from '@/lib/google-auth'
import { usePageTitle } from '@/webapp/hooks'

export function GoogleAuthCompletePage() {
  usePageTitle('Completing Sign In')
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState('Completing Google sign-in...')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true

    const finishAuth = async () => {
      const error = searchParams.get('error')
      if (error) {
        if (!isMounted) return
        clearGoogleAuthContext()
        setStatus('error')
        setMessage('Google sign-in was cancelled or failed.')
        return
      }

      const code = searchParams.get('code')
      const state = searchParams.get('state')
      if (!code || !state) {
        if (!isMounted) return
        clearGoogleAuthContext()
        setStatus('error')
        setMessage('Missing Google sign-in details. Please try again.')
        return
      }

      const context = getGoogleAuthContext()
      if (!context.state || context.state !== state) {
        if (!isMounted) return
        clearGoogleAuthContext()
        setStatus('error')
        setMessage('Google sign-in could not be verified. Please try again.')
        return
      }

      try {
        const response = await completeGoogleAuth(code, state)
        clearGoogleAuthContext()
        setAuthToken(response.token)

        if (response.needs_onboarding) {
          const destination = context.inviteCode
            ? `/onboarding/workspaces?invite_code=${context.inviteCode}`
            : '/onboarding/workspaces'
          window.location.href = destination
          return
        }

        window.location.href = context.redirect || '/'
      } catch (err) {
        if (!isMounted) return
        clearGoogleAuthContext()
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Google sign-in failed')
      }
    }

    finishAuth()

    return () => {
      isMounted = false
    }
  }, [navigate, searchParams])

  return (
    <AuthLayout>
      <div className="grid w-full gap-6">
        <div className="space-y-2">
          <Heading>Signing you in</Heading>
          <Text>{message}</Text>
        </div>

        {status === 'error' && (
          <div className="grid gap-4">
            <Text>
              Return to the{' '}
              <TextLink href="/login">
                <Strong>sign-in page</Strong>
              </TextLink>{' '}
              to try again.
            </Text>
            <Button outline href="/login" className="w-full">
              Back to sign in
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
