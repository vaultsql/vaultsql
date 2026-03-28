import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/components/catalyst/auth-layout'
import { Button } from '@/components/catalyst/button'
import { Divider } from '@/components/catalyst/divider'
import { Field, Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Input } from '@/components/catalyst/input'
import { Strong, Text, TextLink } from '@/components/catalyst/text'
import { setAuthToken } from '@/lib/auth'
import { startGoogleAuth } from '@/lib/google-auth'
import { setReferrerFromUrl } from '@/lib/referrer'
import { useRequestLoginCode, useVerifyLoginCode } from '@/queries/auth'
import { usePageTitle } from '@/webapp/hooks'

export function SignupPage() {
  usePageTitle('Sign Up')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('invite_code')

  const requestCode = useRequestLoginCode()
  const verifyCode = useVerifyLoginCode()

  // Set referrer cookie on page load if ref param is present
  useEffect(() => {
    setReferrerFromUrl(searchParams)
  }, [searchParams])

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await requestCode.mutateAsync({ email })
      setCodeSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await verifyCode.mutateAsync({ email, code })
      setAuthToken(response.token)

      const destination = inviteCode
        ? `/onboarding/workspaces?invite_code=${inviteCode}`
        : '/onboarding/workspaces'
      window.location.href = destination
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code')
    }
  }

  const handleGoogleSignup = async () => {
    setError('')
    setIsGoogleLoading(true)
    try {
      await startGoogleAuth({ inviteCode })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setIsGoogleLoading(false)
    }
  }

  return (
    <AuthLayout>
      {!codeSent ? (
        <form onSubmit={handleRequestCode} className="grid w-full grid-cols-1 gap-6">
          <div className="space-y-2">
            <Heading>Create your VaultSQL account</Heading>
            <Text>Enter your email to get started.</Text>
          </div>

          {import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true' && (
            <>
              <Button
                type="button"
                outline
                className="w-full"
                onClick={handleGoogleSignup}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}
              </Button>

              <div className="flex items-center gap-3">
                <Divider soft className="flex-1" />
                <Text className="text-xs text-zinc-500 dark:text-zinc-400">or</Text>
                <Divider soft className="flex-1" />
              </div>
            </>
          )}

          <Field>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </Field>

          {error && <Text className="text-red-600 dark:text-red-400">{error}</Text>}

          <Button type="submit" className="w-full" disabled={requestCode.isPending}>
            {requestCode.isPending ? 'Sending code...' : 'Continue'}
          </Button>

          <Text>
            Already have an account?{' '}
            <TextLink href={inviteCode ? `/login?invite_code=${inviteCode}` : '/login'}>
              <Strong>Sign in</Strong>
            </TextLink>
          </Text>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="grid w-full grid-cols-1 gap-6">
          <div className="space-y-2">
            <Heading>Enter your code</Heading>
            <Text>
              We sent a 6-digit code to <Strong>{email}</Strong>.
            </Text>
          </div>

          <Field>
            <Label>Login Code</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoComplete="one-time-code"
              className="text-center text-2xl tracking-widest font-mono"
            />
          </Field>

          {error && <Text className="text-red-600 dark:text-red-400">{error}</Text>}

          <Button type="submit" className="w-full" disabled={verifyCode.isPending}>
            {verifyCode.isPending ? 'Verifying...' : 'Verify code'}
          </Button>

          <Button
            type="button"
            outline
            className="w-full"
            onClick={() => {
              setCodeSent(false)
              setCode('')
              setError('')
            }}
          >
            Use a different email
          </Button>

          <Text className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
            Didn't receive a code? Check your spam folder or try again.
          </Text>
        </form>
      )}
    </AuthLayout>
  )
}
