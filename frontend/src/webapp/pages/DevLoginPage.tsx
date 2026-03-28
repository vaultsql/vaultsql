import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '@/components/catalyst/auth-layout'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { clearAuthToken, setAuthToken } from '@/lib/auth'
import { useDevLogin } from '@/queries/auth'
import { usePageTitle } from '@/webapp/hooks'

export function DevLoginPage() {
  usePageTitle('Dev Login')
  const { suffix } = useParams<{ suffix?: string }>()
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const devLogin = useDevLogin()
  const label = suffix ? `configured dev user "${suffix}"` : 'configured dev user'

  const handleDevLogin = async () => {
    setError('')

    // Clear existing token first
    clearAuthToken()

    try {
      const response = await devLogin.mutateAsync(suffix)
      setAuthToken(response.token)

      if (response.needs_onboarding) {
        window.location.href = '/onboarding/workspaces'
        return
      }

      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dev login failed')
    }
  }

  return (
    <AuthLayout>
      <div className="grid w-full grid-cols-1 gap-6">
        <div className="space-y-2">
          <Heading>Dev Login</Heading>
          <Text>Login as the {label} (debug mode only)</Text>
        </div>

        {error && <Text className="text-red-600 dark:text-red-400">{error}</Text>}

        <Button
          type="button"
          className="w-full"
          onClick={handleDevLogin}
          disabled={devLogin.isPending}
        >
          {devLogin.isPending ? 'Logging in...' : 'Login as Dev User'}
        </Button>
      </div>
    </AuthLayout>
  )
}
