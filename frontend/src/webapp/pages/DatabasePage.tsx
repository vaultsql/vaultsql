import { PencilSquareIcon, PlusIcon, UserGroupIcon } from '@heroicons/react/20/solid'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog'
import { Divider } from '@/components/catalyst/divider'
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from '@/components/catalyst/dropdown'
import { Description, Field, FieldGroup, Fieldset, Label } from '@/components/catalyst/fieldset'
import { Heading, Subheading } from '@/components/catalyst/heading'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Text } from '@/components/catalyst/text'
import { Textarea } from '@/components/catalyst/textarea'
import { UserAvatar } from '@/components/UserAvatar'
import { useVaultContext } from '@/lib/vault-context'
import { type Access, useAccountAccess, useGrantAccess } from '@/queries/access'
import {
  type Account,
  useCreateAccountWizard,
  useDatabase,
  useDatabaseAccounts,
  useUpdateAccount,
  useUpdateDatabase,
} from '@/queries/databases'
import { type GroupWithMembers, type User, useGroupsWithMembers, useUsers } from '@/queries/groups'
import { usePageTitle } from '@/webapp/hooks'
import {
  getAccessLevelBadgeColor,
  getAccessLevelLabel,
  getEnvironmentBadgeColor,
  getEnvironmentLabel,
} from '@/webapp/utils/access-badges'

type DatabaseFormValues = {
  name: string
  description: string
  environment?: string
}

type AccountFormValues = {
  name: string
  description: string
  accessLevel?: string
}

type CreateAccountValues = {
  name: string
  description: string
  accessLevel: string
  username: string
  password: string
}

// Legacy type aliases for backward compatibility during migration
type ProfileFormValues = AccountFormValues
type CreateProfileValues = CreateAccountValues
type ServerFormValues = DatabaseFormValues

function formatAccessExpiry(grantedUntil?: string | null) {
  if (!grantedUntil) return null
  const date = new Date(grantedUntil)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getUserLabel(user: User) {
  return user.name || user.email
}

function getAccessAvatarUser(access: Access, usersById: Map<string, User>) {
  if (access.user_id) {
    const user = usersById.get(access.user_id)
    if (user) return user
    if (access.user_email) {
      return {
        id: access.user_id,
        email: access.user_email,
        name: '',
        role: 'member',
      } as User
    }
  }
  return null
}

function AccountAccessList({
  databaseId,
  accountId,
  groupsById,
  usersById,
  allUsers,
  allGroups,
}: {
  databaseId: string
  accountId: string
  groupsById: Map<string, GroupWithMembers>
  usersById: Map<string, User>
  allUsers: User[]
  allGroups: GroupWithMembers[]
}) {
  const { data: accessList = [], isLoading, error } = useAccountAccess(databaseId, accountId)
  const grantAccess = useGrantAccess()

  const activeAccess = useMemo(() => {
    const now = Date.now()
    return accessList.filter((access) => {
      if (access.revoked_at || !access.granted_at) return false
      if (access.granted_until) {
        return new Date(access.granted_until).getTime() > now
      }
      return true
    })
  }, [accessList])

  const assignedUserIds = useMemo(() => {
    return new Set(
      activeAccess.map((access) => access.user_id).filter((id): id is string => Boolean(id)),
    )
  }, [activeAccess])

  const assignedGroupIds = useMemo(() => {
    return new Set(
      activeAccess.map((access) => access.group_id).filter((id): id is string => Boolean(id)),
    )
  }, [activeAccess])

  const availableUsers = useMemo(
    () => allUsers.filter((user) => !assignedUserIds.has(user.id)),
    [allUsers, assignedUserIds],
  )

  const availableGroups = useMemo(
    () => allGroups.filter((group) => !assignedGroupIds.has(group.id)),
    [allGroups, assignedGroupIds],
  )

  const handleGrantUser = async (userId: string) => {
    try {
      await grantAccess.mutateAsync({
        database_id: databaseId,
        account_id: accountId,
        user_id: userId,
      })
    } catch {
      // Error surfaced by mutation state.
    }
  }

  const handleGrantGroup = async (groupId: string) => {
    try {
      await grantAccess.mutateAsync({
        database_id: databaseId,
        account_id: accountId,
        group_id: groupId,
      })
    } catch {
      // Error surfaced by mutation state.
    }
  }

  if (isLoading) {
    return <Text className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</Text>
  }

  if (error) {
    return <Text className="text-sm text-red-600">Failed to load access: {error.message}</Text>
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-zinc-950/20 bg-gradient-to-br from-sky-50/70 via-white/80 to-emerald-50/60 p-3 dark:border-white/15 dark:from-slate-900/80 dark:via-zinc-900/70 dark:to-slate-900/80">
        <div className="flex flex-wrap items-center gap-3">
          <Dropdown>
            <DropdownButton outline disabled={availableUsers.length === 0 || grantAccess.isPending}>
              <PlusIcon data-slot="icon" />
              Add user
            </DropdownButton>
            <DropdownMenu>
              {availableUsers.map((user) => (
                <DropdownItem key={user.id} onClick={() => void handleGrantUser(user.id)}>
                  <div className="flex items-center gap-2">
                    <UserAvatar user={user} className="size-6" />
                    <div>
                      <div className="text-sm">{getUserLabel(user)}</div>
                      <div className="text-xs text-zinc-500">{user.email}</div>
                    </div>
                  </div>
                </DropdownItem>
              ))}
              {availableUsers.length === 0 && (
                <DropdownItem disabled>Everyone already has access</DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
          <Dropdown>
            <DropdownButton
              outline
              disabled={availableGroups.length === 0 || grantAccess.isPending}
            >
              <PlusIcon data-slot="icon" />
              Add group
            </DropdownButton>
            <DropdownMenu>
              {availableGroups.map((group) => (
                <DropdownItem key={group.id} onClick={() => void handleGrantGroup(group.id)}>
                  <div className="text-sm">{group.name}</div>
                </DropdownItem>
              ))}
              {availableGroups.length === 0 && (
                <DropdownItem disabled>Every group already has access</DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
          {grantAccess.isPending && <Text className="text-sm text-zinc-500">Adding...</Text>}
          {grantAccess.error && (
            <Text className="text-sm text-red-600">{grantAccess.error.message}</Text>
          )}
        </div>
      </div>

      {activeAccess.length === 0 && (
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
          No access assigned yet. Add members or groups to grant entry.
        </Text>
      )}
      {activeAccess.map((access) => {
        const expiryLabel = formatAccessExpiry(access.granted_until)
        if (access.group_id) {
          const group = groupsById.get(access.group_id)
          const members = group?.members ?? []
          const displayedAvatars = members.slice(0, 5)
          const remainingCount = Math.max(0, members.length - displayedAvatars.length)

          return (
            <div
              key={access.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-950/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/70"
            >
              <div className="flex min-w-[240px] items-center gap-3">
                <span className="rounded-full border border-zinc-950/10 bg-zinc-950/5 p-2 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200">
                  <UserGroupIcon className="size-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-950 dark:text-white">
                      {group?.name ?? access.group_name ?? 'Group'}
                    </span>
                    <Badge color="sky">Group access</Badge>
                  </div>
                  <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                    {members.length} members
                  </Text>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {displayedAvatars.map((member) => (
                  <UserAvatar key={member.id} user={member} className="size-7" />
                ))}
                {remainingCount > 0 && (
                  <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                    +{remainingCount}
                  </Text>
                )}
              </div>
              {expiryLabel && <Badge color="amber">Expires {expiryLabel}</Badge>}
            </div>
          )
        }

        const user = getAccessAvatarUser(access, usersById)
        if (!user) return null

        return (
          <div
            key={access.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-950/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/70"
          >
            <div className="flex min-w-[240px] items-center gap-3">
              <UserAvatar user={user} className="size-7" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {getUserLabel(user)}
                  </span>
                  <Badge color="teal">Member</Badge>
                </div>
                <Text className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</Text>
              </div>
            </div>
            {expiryLabel && <Badge color="amber">Expires {expiryLabel}</Badge>}
          </div>
        )
      })}
    </div>
  )
}

function AccountFormDialog({
  open,
  title,
  description,
  confirmLabel,
  initialValues,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  initialValues: AccountFormValues
  isPending: boolean
  errorMessage?: string | null
  onClose: () => void
  onSubmit: (values: AccountFormValues) => void
}) {
  const [name, setName] = useState(initialValues.name)
  const [details, setDetails] = useState(initialValues.description)
  const [accessLevel, setAccessLevel] = useState(initialValues.accessLevel || 'readonly')

  useEffect(() => {
    if (open) {
      setName(initialValues.name)
      setDetails(initialValues.description)
      setAccessLevel(initialValues.accessLevel || 'readonly')
    }
  }, [open, initialValues.name, initialValues.description, initialValues.accessLevel])

  const trimmedName = name.trim()

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <DialogBody>
        <Fieldset>
          <FieldGroup>
            <Field>
              <Label>Account name</Label>
              <Description>Visible to admins and approvers.</Description>
              <Input
                placeholder="Read-only access"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            <Field>
              <Label>
                Description <span className="text-zinc-500">(optional)</span>
              </Label>
              <Description>Capture the intent for this account.</Description>
              <Textarea
                placeholder="Shared purpose or access boundary."
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                rows={3}
              />
            </Field>
            <Field>
              <Label>Access Level</Label>
              <Description>The level of database access this account provides</Description>
              <Select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value)}>
                <option value="readonly">Read-only - Can query data but cannot modify it</option>
                <option value="write">Write - Can query and modify data</option>
                <option value="admin">Admin - Full access including schema changes</option>
              </Select>
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
          onClick={() => onSubmit({ name: trimmedName, description: details.trim(), accessLevel })}
          disabled={!trimmedName || isPending}
        >
          {isPending ? 'Saving...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function CreateAccountDialog({
  open,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: {
  open: boolean
  isPending: boolean
  errorMessage?: string | null
  onClose: () => void
  onSubmit: (values: CreateAccountValues) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [accessLevel, setAccessLevel] = useState('readonly')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setAccessLevel('readonly')
      setUsername('')
      setPassword('')
    }
  }, [open])

  const trimmedName = name.trim()
  const trimmedUsername = username.trim()

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>Create account</DialogTitle>
      <DialogDescription>
        Add a new access account for this database. We'll validate the credentials before saving.
      </DialogDescription>
      <DialogBody>
        <Fieldset>
          <FieldGroup>
            <Field>
              <Label>Account name</Label>
              <Description>Short label for admins and approvers.</Description>
              <Input
                placeholder="e.g. Read-only"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            <Field>
              <Label>
                Description <span className="text-zinc-500">(optional)</span>
              </Label>
              <Textarea
                placeholder="Optional details about the access boundary."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </Field>
            <Field>
              <Label>Access Level</Label>
              <Description>The level of database access this account provides</Description>
              <Select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value)}>
                <option value="readonly">Read-only - Can query data but cannot modify it</option>
                <option value="write">Write - Can query and modify data</option>
                <option value="admin">Admin - Full access including schema changes</option>
              </Select>
            </Field>
            <Field>
              <Label>Database username</Label>
              <Description>Used to validate the account with the database.</Description>
              <Input
                placeholder="readonly_user"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </Field>
            <Field>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
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
          onClick={() =>
            onSubmit({
              name: trimmedName,
              description: description.trim(),
              accessLevel,
              username: trimmedUsername,
              password,
            })
          }
          disabled={!trimmedName || !trimmedUsername || !password || isPending}
        >
          {isPending ? 'Creating...' : 'Create account'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DatabaseEditDialog({
  open,
  initialValues,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: {
  open: boolean
  initialValues: DatabaseFormValues
  isPending: boolean
  errorMessage?: string | null
  onClose: () => void
  onSubmit: (values: DatabaseFormValues) => void
}) {
  const [name, setName] = useState(initialValues.name)
  const [description, setDescription] = useState(initialValues.description)
  const [environment, setEnvironment] = useState(initialValues.environment || '')

  useEffect(() => {
    if (open) {
      setName(initialValues.name)
      setDescription(initialValues.description)
      setEnvironment(initialValues.environment || '')
    }
  }, [open, initialValues.name, initialValues.description, initialValues.environment])

  const trimmedName = name.trim()

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>Edit database</DialogTitle>
      <DialogDescription>Update the database name and description.</DialogDescription>
      <DialogBody>
        <Fieldset>
          <FieldGroup>
            <Field>
              <Label>Database name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field>
              <Label>
                Description <span className="text-zinc-500">(optional)</span>
              </Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </Field>
            <Field>
              <Label>Environment (optional)</Label>
              <Description>Classify this database by environment</Description>
              <Select value={environment} onChange={(event) => setEnvironment(event.target.value)}>
                <option value="">No environment</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="testing">Testing</option>
                <option value="development">Development</option>
              </Select>
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
          onClick={() =>
            onSubmit({
              name: trimmedName,
              description: description.trim(),
              environment: environment || undefined,
            })
          }
          disabled={!trimmedName || isPending}
        >
          {isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function DatabasePage() {
  const { databaseId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showSuccess, setShowSuccess] = useState(false)
  const [showEditDatabase, setShowEditDatabase] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const { isVaultMode, passphrase } = useVaultContext()

  const {
    data: database,
    isLoading: isDatabaseLoading,
    error: databaseError,
  } = useDatabase(databaseId ?? '', {
    enabled: Boolean(databaseId),
  })

  usePageTitle(database?.name ?? 'Database')
  const {
    data: accounts = [],
    isLoading: accountsLoading,
    error: accountsError,
  } = useDatabaseAccounts(databaseId ?? '', { enabled: Boolean(databaseId) })
  const { data: users = [] } = useUsers()
  const { data: groups = [] } = useGroupsWithMembers()
  const updateDatabase = useUpdateDatabase()
  const updateAccount = useUpdateAccount()
  const createAccount = useCreateAccountWizard()

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])

  // Check if we just created this database
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowSuccess(true)
      // Remove the query param from URL
      searchParams.delete('create')
      setSearchParams(searchParams, { replace: true })

      // Auto-hide success message after 5 seconds
      const timer = setTimeout(() => {
        setShowSuccess(false)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [searchParams, setSearchParams])

  const handleDatabaseSubmit = async (data: DatabaseFormValues) => {
    if (!databaseId) return
    try {
      await updateDatabase.mutateAsync({
        databaseId,
        payload: {
          name: data.name.trim(),
          description: data.description.trim(),
          environment: data.environment || undefined,
        },
      })
      setShowEditDatabase(false)
      updateDatabase.reset()
    } catch {
      // Error handled via mutation state.
    }
  }

  const handleAccountUpdate = async (values: AccountFormValues) => {
    if (!databaseId || !editAccount) return
    try {
      await updateAccount.mutateAsync({
        databaseId,
        accountId: editAccount.id,
        payload: {
          name: values.name.trim(),
          description: values.description.trim(),
          access_level: values.accessLevel,
        },
      })
      setEditAccount(null)
      updateAccount.reset()
    } catch {
      // Error handled via mutation state.
    }
  }

  const handleAccountCreate = async (values: CreateAccountValues) => {
    if (!databaseId) return
    // Vault gate ensures passphrase is available on this page
    if (isVaultMode && !passphrase) {
      console.error('Passphrase not available - vault gate should have prevented this')
      return
    }
    try {
      await createAccount.mutateAsync({
        databaseId,
        payload: {
          name: values.name.trim(),
          description: values.description.trim(),
          permissions: {},
          access_level: values.accessLevel,
          account_credentials: {
            username: values.username.trim(),
            password: values.password,
          },
          passphrase: isVaultMode ? passphrase : undefined,
        },
      })
      setShowCreateAccount(false)
      createAccount.reset()
    } catch {
      // Error handled via mutation state.
    }
  }

  if (!databaseId) {
    return (
      <div className="p-8">
        <Heading>Database</Heading>
        <Text className="mt-2 text-red-600">Missing database ID.</Text>
      </div>
    )
  }

  if (isDatabaseLoading) {
    return (
      <div className="p-8">
        <Heading>Database</Heading>
        <Text className="mt-2">Loading database details...</Text>
      </div>
    )
  }

  if (databaseError || !database) {
    return (
      <div className="p-8">
        <Heading>Database</Heading>
        <Text className="mt-2 text-red-600">
          {databaseError
            ? `Failed to load database: ${databaseError.message}`
            : 'Database not found.'}
        </Text>
      </div>
    )
  }

  return (
    <div className="space-y-10 p-8">
      {showSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/50">
          <Text className="font-medium text-green-900 dark:text-green-100">
            Database created successfully!
          </Text>
          <Text className="mt-1 text-sm text-green-800 dark:text-green-200">
            Your database has been configured and is ready to use.
          </Text>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-950/10 bg-white/80 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-4">
            <div>
              <Heading>{database.name}</Heading>
              {database.description && (
                <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {database.description}
                </Text>
              )}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Type
                </Text>
                <Text className="mt-1 font-medium text-zinc-900 dark:text-white">
                  {database.database_type.toUpperCase()}
                </Text>
              </div>
              <div>
                <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Environment
                </Text>
                <div className="mt-1">
                  {database.environment ? (
                    <Badge color={getEnvironmentBadgeColor(database.environment)}>
                      {getEnvironmentLabel(database.environment)}
                    </Badge>
                  ) : (
                    <Text className="text-zinc-500 dark:text-zinc-400">—</Text>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            <Button outline onClick={() => setShowEditDatabase(true)}>
              <PencilSquareIcon data-slot="icon" />
              Edit
            </Button>
            <Button onClick={() => setShowCreateAccount(true)}>
              <PlusIcon data-slot="icon" />
              Add account
            </Button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Subheading>Accounts</Subheading>
          <Badge color="zinc">{accounts.length} total</Badge>
        </div>
        {accountsLoading && <Text className="mt-3 text-sm text-zinc-500">Loading accounts...</Text>}
        {accountsError && (
          <Text className="mt-3 text-sm text-red-600">
            Failed to load accounts: {accountsError.message}
          </Text>
        )}
        {!accountsLoading && accounts.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-sky-200/80 bg-sky-50/70 p-8 text-center dark:border-sky-900/50 dark:bg-slate-900/70">
            <Text className="text-sm text-slate-700 dark:text-slate-300">
              No accounts configured yet. Each account represents a set of database credentials with
              specific permissions.
            </Text>
            <div className="mt-4 flex justify-center">
              <Button onClick={() => setShowCreateAccount(true)}>Create account</Button>
            </div>
          </div>
        )}
        <div className="mt-6 space-y-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-2xl border border-zinc-950/10 bg-white/80 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/70"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-semibold text-zinc-950 dark:text-white">
                      {account.name}
                    </span>
                    <Badge color={getAccessLevelBadgeColor(account.access_level)}>
                      {getAccessLevelLabel(account.access_level)}
                    </Badge>
                    {!account.is_active && <Badge color="amber">Inactive</Badge>}
                    {!account.has_credentials && <Badge color="rose">Missing credentials</Badge>}
                  </div>
                  <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                    {!account.has_credentials
                      ? 'This account is missing database credentials. Click "Edit account" to configure them.'
                      : account.description || 'No description set for this account.'}
                  </Text>
                </div>
                <Button outline onClick={() => setEditAccount(account)}>
                  <PencilSquareIcon data-slot="icon" />
                  Edit account
                </Button>
              </div>
              <Divider soft />
              <div className="px-6 py-5">
                <div className="flex items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Account access
                  </Text>
                  <Text className="text-xs text-zinc-500">Groups and members</Text>
                </div>
                <div className="mt-4">
                  <AccountAccessList
                    databaseId={databaseId}
                    accountId={account.id}
                    groupsById={groupsById}
                    usersById={usersById}
                    allUsers={users}
                    allGroups={groups}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AccountFormDialog
        open={Boolean(editAccount)}
        title="Edit account"
        description="Update account name and description."
        confirmLabel="Save changes"
        initialValues={{
          name: editAccount?.name ?? '',
          description: editAccount?.description ?? '',
          accessLevel: editAccount?.access_level ?? 'readonly',
        }}
        isPending={updateAccount.isPending}
        errorMessage={updateAccount.error?.message ?? null}
        onClose={() => {
          setEditAccount(null)
          updateAccount.reset()
        }}
        onSubmit={handleAccountUpdate}
      />

      <CreateAccountDialog
        open={showCreateAccount}
        isPending={createAccount.isPending}
        errorMessage={createAccount.error?.message ?? null}
        onClose={() => {
          setShowCreateAccount(false)
          createAccount.reset()
        }}
        onSubmit={handleAccountCreate}
      />

      <DatabaseEditDialog
        open={showEditDatabase}
        initialValues={{
          name: database.name,
          description: database.description ?? '',
          environment: database.environment ?? undefined,
        }}
        isPending={updateDatabase.isPending}
        errorMessage={updateDatabase.error?.message ?? null}
        onClose={() => {
          setShowEditDatabase(false)
          updateDatabase.reset()
        }}
        onSubmit={handleDatabaseSubmit}
      />
    </div>
  )
}
