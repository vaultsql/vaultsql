import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type Step, StepIndicator } from '@/components/StepIndicator'
import { useAppContext } from '@/lib/app-context'
import { useConfirmKey, useCreateKey, useInvalidateUser } from '@/queries/keys'
import { useUser } from '@/queries/user'
import { usePageTitle } from '@/webapp/hooks'
import { AwaitingApprovalStep } from './key-reset/AwaitingApprovalStep'
import { OverviewStep } from './key-reset/OverviewStep'
import { SavePassphraseStep } from './key-reset/SavePassphraseStep'
import { SoloAdminScreen } from './key-reset/SoloAdminScreen'

type ResetStep = 1 | 2 | 3

export function KeyResetPage() {
  usePageTitle('Key Reset')
  const navigate = useNavigate()
  const { data: userData } = useUser()
  const createKey = useCreateKey()
  const confirmKey = useConfirmKey()
  const invalidateUser = useInvalidateUser()
  const { clearVault } = useAppContext()

  const [currentStep, setCurrentStep] = useState<ResetStep>(1)
  const [keyId, setKeyId] = useState<string | null>(null)
  const [passphrase, setPassphrase] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const isSoloAdmin = userData?.flags?.is_solo_admin ?? false

  // Get the current key's passphrase hint from /user/me (backend-guaranteed to be the correct key)
  // Only show hint if the key is approved (active) - during reset we want the OLD key's hint
  const currentKey = userData?.key
  const oldKeyHint = currentKey?.approved_at ? currentKey.passphrase_hint : undefined

  const handleStartReset = async () => {
    setCreateError(null)
    try {
      const result = await createKey.mutateAsync()
      setKeyId(result.id)
      setPassphrase(result.passphrase)
      setCurrentStep(2)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create key')
    }
  }

  const handleCompleteReset = async () => {
    if (!keyId) return
    setConfirmError(null)
    try {
      await confirmKey.mutateAsync(keyId)
      // Clear the vault since the old key is now revoked
      await clearVault()
      // Invalidate user query to refetch flags
      invalidateUser()
      // Move to step 3
      setCurrentStep(3)
      // Reset state
      setPassphrase(null)
      setKeyId(null)
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : 'Failed to complete reset')
    }
  }

  const handleCancel = () => {
    navigate('/')
  }

  // Build steps array based on current state
  const steps: Step[] = [
    {
      number: 1,
      title: 'Overview',
      status: currentStep === 1 ? 'current' : currentStep > 1 ? 'completed' : 'upcoming',
    },
    {
      number: 2,
      title: 'Save New Key',
      status: currentStep === 2 ? 'current' : currentStep > 2 ? 'completed' : 'upcoming',
    },
    {
      number: 3,
      title: 'Awaiting Approval',
      status: currentStep === 3 ? 'current' : 'upcoming',
    },
  ]

  // Solo admin screen
  if (isSoloAdmin) {
    return <SoloAdminScreen onCancel={handleCancel} />
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Back button at top */}
      <div className="px-6 pt-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Go home
        </button>
      </div>

      {/* Step Indicator at top */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <StepIndicator steps={steps} />
        </div>
      </div>

      {/* Step Content */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          {currentStep === 1 && (
            <OverviewStep
              onStartReset={handleStartReset}
              onCancel={handleCancel}
              isCreating={createKey.isPending}
              error={createError}
            />
          )}

          {currentStep === 2 && passphrase && (
            <SavePassphraseStep
              passphrase={passphrase}
              oldKeyHint={oldKeyHint}
              onCompleteReset={handleCompleteReset}
              onCancel={handleCancel}
              isConfirming={confirmKey.isPending}
              error={confirmError}
            />
          )}

          {currentStep === 3 && <AwaitingApprovalStep onReturn={handleCancel} />}
        </div>
      </div>
    </div>
  )
}
