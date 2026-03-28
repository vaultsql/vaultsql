import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { ErrorMessage, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { clearReferrerCookie, getReferrerCookie } from '@/lib/referrer'
import { useCreateWorkspace } from '@/queries/identity'

interface CreateWorkspaceFormProps {
  onSuccess: (token: string) => void
  onError?: (error: string) => void
  defaultName?: string
}

export function CreateWorkspaceForm({
  onSuccess,
  onError,
  defaultName = '',
}: CreateWorkspaceFormProps) {
  const [name, setName] = useState('')
  const [userName, setUserName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)

  const createWorkspace = useCreateWorkspace()

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      const referrer = getReferrerCookie()
      const data = await createWorkspace.mutateAsync({
        name,
        slug: slugify(name),
        mode: 'vault',
        userName: userName.trim(),
        referrer,
      })

      // Clear the referrer cookie after successful workspace creation
      clearReferrerCookie()
      onSuccess(data.token)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create workspace'
      setError(errorMessage)
      onError?.(errorMessage)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FieldGroup>
        <Field>
          <Label>Your Name</Label>
          <Input
            name="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
            autoFocus
          />
        </Field>

        <Field>
          <Label>Workspace Name</Label>
          <Input name="name" value={name} onChange={handleNameChange} required />
        </Field>
      </FieldGroup>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <Button
        type="submit"
        className="w-full"
        disabled={createWorkspace.isPending || !name.trim() || !userName.trim()}
      >
        {createWorkspace.isPending ? 'Creating...' : 'Create Workspace'}
      </Button>
    </form>
  )
}
