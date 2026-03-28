import { InfoIcon, LockIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useVaultContext } from '@/lib/vault-context'

interface VaultInfoPopoverProps {
  children: React.ReactNode
}

export function VaultInfoPopover({ children }: VaultInfoPopoverProps) {
  const { lockVault } = useVaultContext()
  const [open, setOpen] = useState(false)

  const handleLockVault = async () => {
    await lockVault()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <InfoIcon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Vault Mode Active</h4>
              <p className="text-xs text-muted-foreground">
                Your vault unlock code is stored securely on this browser. Credentials are encrypted
                end-to-end.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border">
            <Button onClick={handleLockVault} className="w-full" outline>
              <LockIcon className="w-4 h-4" />
              Lock Vault
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
