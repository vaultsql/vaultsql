import { ClockIcon, KeyIcon } from '@heroicons/react/24/outline'
import { Check, Copy, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { type Step, StepIndicator } from '@/components/StepIndicator'
import { useConfirmKey, useCreateKey, useInvalidateUser } from '@/queries/keys'

interface VaultKeyEmptyStateProps {
  needsCreate: boolean
}

export function VaultKeyEmptyState({ needsCreate }: VaultKeyEmptyStateProps) {
  const createKey = useCreateKey()
  const confirmKey = useConfirmKey()
  const invalidateUser = useInvalidateUser()
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(needsCreate ? 1 : 3)
  const [keyId, setKeyId] = useState<string | null>(null)
  const [passphrase, setPassphrase] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // Update current step when needsCreate changes
  useEffect(() => {
    if (needsCreate && !passphrase && currentStep !== 1) {
      setCurrentStep(1)
    } else if (!needsCreate && !passphrase && currentStep !== 3) {
      setCurrentStep(3)
    }
  }, [needsCreate, passphrase, currentStep])

  const handleCreate = async () => {
    try {
      const result = await createKey.mutateAsync()
      setKeyId(result.id)
      setPassphrase(result.passphrase)
      setCurrentStep(2)
    } catch (error) {
      console.error('Failed to create key:', error)
    }
  }

  const handleCopy = async () => {
    if (passphrase) {
      await navigator.clipboard.writeText(passphrase)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (passphrase) {
      const blob = new Blob([passphrase], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Extract first two words from passphrase for filename
      const words = passphrase.split(' ').slice(0, 2).join('-')
      a.download = `vaultsql-key-${words}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleContinue = async () => {
    if (!keyId) return
    setConfirmError(null)
    try {
      await confirmKey.mutateAsync(keyId)
      // Invalidate user query to refetch flags
      invalidateUser()
      // Move to step 3 (or user will be unlocked if solo admin)
      setCurrentStep(3)
      // Reset state
      setPassphrase(null)
      setConfirmed(false)
      setCopied(false)
      setKeyId(null)
    } catch (error) {
      console.error('Failed to confirm key:', error)
      setConfirmError('Unable to confirm key. Please try again.')
    }
  }

  // Build steps array based on current state
  const steps: Step[] = [
    {
      number: 1,
      title: 'Create Passphrase',
      status: currentStep === 1 ? 'current' : currentStep > 1 ? 'completed' : 'upcoming',
    },
    {
      number: 2,
      title: 'Save Passphrase',
      status: currentStep === 2 ? 'current' : currentStep > 2 ? 'completed' : 'upcoming',
    },
    {
      number: 3,
      title: 'Admin Approval',
      status: currentStep === 3 ? 'current' : 'upcoming',
    },
  ]

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Step Indicator at top */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <StepIndicator steps={steps} />
        </div>
      </div>

      {/* Step Content */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg text-center">
          {/* Step 1: Create Key */}
          {currentStep === 1 && (
            <>
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <KeyIcon className="h-8 w-8 text-zinc-600 dark:text-zinc-400" />
              </div>

              <Heading className="text-2xl">Create your vault passphrase</Heading>
              <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
                This workspace uses end-to-end encryption. Your passphrase protects database
                credentials so only you can decrypt them - even we can't access them without it.
              </Text>
              <Text className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">
                You'll see it only once, so store it safely. If you lose it, you'll need an admin to
                approve a new one.{' '}
                <a
                  href="https://docs.vaultsql.com/vault-mode"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Learn more
                </a>
              </Text>

              <div className="mt-8">
                <Button onClick={handleCreate} disabled={createKey.isPending} className="w-full">
                  {createKey.isPending ? 'Creating...' : 'Create Passphrase'}
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Save Passphrase */}
          {currentStep === 2 && passphrase && (
            <>
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
                <KeyIcon className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>

              <Heading className="text-2xl">Save your passphrase</Heading>
              <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
                Store this securely - you'll need it to unlock your vault. This is the only time
                you'll see it.
              </Text>

              <div className="mt-8 space-y-6">
                <div className="bg-zinc-100 dark:bg-zinc-800 p-6 rounded-lg font-mono text-lg text-center select-all break-words">
                  {passphrase}
                </div>

                <div className="flex gap-2">
                  <Button outline onClick={handleCopy} className="flex-1">
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button outline onClick={handleDownload} className="flex-1">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>

                <CheckboxField className="text-left">
                  <Checkbox checked={confirmed} onChange={(checked) => setConfirmed(checked)} />
                  <Label>I've saved this passphrase</Label>
                </CheckboxField>

                {confirmError && (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {confirmError}
                  </div>
                )}

                <Button onClick={handleContinue} disabled={!confirmed} className="w-full">
                  Continue
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Waiting for Approval */}
          {currentStep === 3 && (
            <>
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
                <ClockIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>

              <Heading className="text-2xl">Waiting for admin approval</Heading>
              <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
                Your passphrase creates a new encryption key. An admin must approve it to ensure
                security - this prevents unauthorized access.
              </Text>
              <Text className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">
                We've notified your workspace admins. You'll be able to connect to databases once
                approved.
              </Text>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
