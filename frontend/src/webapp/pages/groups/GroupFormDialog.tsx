import { useEffect, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog'
import { Description, Field, FieldGroup, Fieldset, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Text } from '@/components/catalyst/text'
import { Textarea } from '@/components/catalyst/textarea'

type GroupFormValues = {
  name: string
  description: string
}

interface GroupFormDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  initialValues?: GroupFormValues
  isPending?: boolean
  errorMessage?: string | null
  onClose: () => void
  onSubmit: (values: GroupFormValues) => void
}

export function GroupFormDialog({
  open,
  title,
  description,
  confirmLabel,
  initialValues = { name: '', description: '' },
  isPending = false,
  errorMessage,
  onClose,
  onSubmit,
}: GroupFormDialogProps) {
  const [name, setName] = useState(initialValues.name)
  const [details, setDetails] = useState(initialValues.description)

  useEffect(() => {
    if (open) {
      setName(initialValues.name)
      setDetails(initialValues.description)
    }
  }, [open, initialValues.name, initialValues.description])

  const trimmedName = name.trim()

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <DialogBody>
        <Fieldset>
          <FieldGroup>
            <Field>
              <Label>Group name</Label>
              <Description>Short, recognizable label for your team.</Description>
              <Input
                placeholder="e.g. Security Review"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            <Field>
              <Label>
                Description <span className="text-zinc-500">(optional)</span>
              </Label>
              <Description>Explain the group's focus and approval scope.</Description>
              <Textarea
                placeholder="Optional details about responsibilities and scope."
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                rows={3}
              />
            </Field>
          </FieldGroup>
        </Fieldset>
        {errorMessage && (
          <Text className="mt-4 text-sm text-red-600 dark:text-red-400">{errorMessage}</Text>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={() => onSubmit({ name: trimmedName, description: details.trim() })}
          disabled={!trimmedName || isPending}
        >
          {isPending ? 'Saving...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
