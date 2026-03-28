import { CheckIcon, CopyIcon, DownloadIcon, KeyRoundIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'

interface SavePassphraseStepProps {
  passphrase: string
  oldKeyHint: string | undefined
  onCompleteReset: () => void
  onCancel: () => void
  isConfirming: boolean
  error: string | null
}

export function SavePassphraseStep({
  passphrase,
  oldKeyHint,
  onCompleteReset,
  onCancel,
  isConfirming,
  error,
}: SavePassphraseStepProps) {
  const [copied, setCopied] = useState(false)
  const [savedChecked, setSavedChecked] = useState(false)
  const [blockedChecked, setBlockedChecked] = useState(false)

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(passphrase)
    setCopied(true)
  }

  const handleDownload = () => {
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

  return (
    <div className="text-center">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
        <KeyRoundIcon className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>

      <Heading className="text-2xl">Save Your New Passphrase</Heading>
      <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
        Store this securely - you'll need it to unlock your vault. This is the only time you'll see
        it.
      </Text>

      <div className="mt-8 space-y-6">
        <div className="bg-zinc-100 dark:bg-zinc-800 p-6 rounded-lg font-mono text-lg text-center select-all break-all">
          {passphrase}
        </div>

        <div className="flex gap-2">
          <Button outline onClick={handleCopy} className="flex-1">
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4 mr-1" />
                Copied
              </>
            ) : (
              <>
                <CopyIcon className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </Button>
          <Button outline onClick={handleDownload} className="flex-1">
            <DownloadIcon className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>

        <div className="space-y-3 text-left">
          <CheckboxField>
            <Checkbox checked={savedChecked} onChange={(checked) => setSavedChecked(checked)} />
            <Label>I have saved this passphrase securely</Label>
          </CheckboxField>

          <CheckboxField>
            <Checkbox checked={blockedChecked} onChange={(checked) => setBlockedChecked(checked)} />
            <Label>
              I understand my old passphrase {oldKeyHint && `(${oldKeyHint}...)`} will be blocked
            </Label>
          </CheckboxField>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button outline onClick={onCancel} className="flex-1">
            Cancel Reset
          </Button>
          <Button
            onClick={onCompleteReset}
            disabled={!savedChecked || !blockedChecked || isConfirming}
            className="flex-1"
          >
            {isConfirming ? 'Completing...' : 'Complete Reset'}
          </Button>
        </div>
      </div>
    </div>
  )
}
