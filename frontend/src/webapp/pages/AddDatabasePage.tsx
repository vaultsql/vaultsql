import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog'
import { Description, ErrorMessage, Field, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Text } from '@/components/catalyst/text'
import { Textarea } from '@/components/catalyst/textarea'
import {
  FieldStack,
  SettingsDivider,
  SettingsFooter,
  SettingsForm,
  SettingsHeader,
  SettingsSection,
} from '@/components/settings-form'
import { useVaultContext } from '@/lib/vault-context'
import type { DatabaseCreateWizardRequest } from '@/queries/databases'
import { useCreateDatabase } from '@/queries/databases'
import { usePageTitle } from '@/webapp/hooks'

interface DatabaseFormData {
  name: string
  databaseType: string
  environment: string
  hostname: string
  port: number
  database: string
  sslMode: string
  useSsh: boolean
  sshHost: string
  sshPort: number
  sshUser: string
  username: string
  password: string
  accessLevel: string
}

export function AddDatabasePage() {
  usePageTitle('Add Database')
  const navigate = useNavigate()
  const { isVaultMode, passphrase } = useVaultContext()
  const createDatabase = useCreateDatabase()
  const [showConnectionStringModal, setShowConnectionStringModal] = useState(false)

  const form = useForm<DatabaseFormData>({
    defaultValues: {
      name: '',
      databaseType: 'postgres',
      environment: '',
      hostname: '',
      port: 5432,
      database: 'postgres',
      sslMode: 'prefer',
      useSsh: false,
      sshHost: '',
      sshPort: 22,
      sshUser: '',
      username: '',
      password: '',
      accessLevel: 'readonly',
    },
  })

  const {
    watch,
    register,
    formState: { errors },
    setValue,
  } = form
  const useSsh = watch('useSsh')
  const databaseType = watch('databaseType')

  // Update port and database defaults when database type changes
  const handleDatabaseTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value
    if (newType === 'mysql') {
      setValue('port', 3306)
      setValue('database', '')
    } else if (newType === 'postgres') {
      setValue('port', 5432)
      setValue('database', 'postgres')
    }
  }

  const onSubmit = async (data: DatabaseFormData) => {
    // Vault gate ensures passphrase is available on this page
    if (isVaultMode && !passphrase) {
      console.error('Passphrase not available - vault gate should have prevented this')
      return
    }

    try {
      // Build server credentials
      const serverCredentials: Record<string, unknown> = {
        hostname: data.hostname,
        port: data.port,
        database: data.database,
        ssl_mode: data.sslMode,
      }

      // Add SSH config if enabled
      if (data.useSsh) {
        serverCredentials.ssh = {
          host: data.sshHost,
          port: data.sshPort,
          user: data.sshUser,
        }
      }

      // Build profile credentials
      const profileCredentials = {
        username: data.username,
        password: data.password,
      }

      // Build the payload
      const payload: DatabaseCreateWizardRequest = {
        name: data.name,
        database_type: data.databaseType,
        description: '',
        environment: data.environment || undefined,
        account_name: data.accessLevel, // Use access level as account name
        account_description: '',
        database_credentials: serverCredentials,
        account_credentials: profileCredentials,
        access_level: data.accessLevel,
      }

      // Add passphrase if in vault mode
      if (isVaultMode && passphrase) {
        payload.passphrase = passphrase
      }

      // Create the server
      const result = await createDatabase.mutateAsync(payload)

      // Redirect to server page with success flag
      navigate(`/database/${result.id}?create=true`)
    } catch (error) {
      // Error is already handled by the mutation
      console.error('Failed to create server:', error)
    }
  }

  const handleCopySshKey = () => {
    const sshKey = import.meta.env.VITE_SSH_PUBLIC_KEY || 'SSH key not configured'
    navigator.clipboard.writeText(sshKey)
  }

  const parseConnectionString = (connectionString: string) => {
    try {
      // Support both postgres:// and postgresql:// schemes, as well as mysql://

      const urlPattern =
        /^(postgres|postgresql|mysql):\/\/(?:([^:@]+)(?::([^@]+))?@)?([^:/]+)(?::(\d+))?\/([^?]+)(?:\?(.+))?$/
      const match = connectionString.trim().match(urlPattern)

      if (!match) {
        return { error: 'Invalid connection string format' }
      }

      const [, protocol, username, password, hostname, port, database, queryParams] = match

      // Parse query parameters for SSL mode
      let sslMode = 'prefer'
      if (queryParams) {
        const params = new URLSearchParams(queryParams)
        sslMode = params.get('sslmode') || params.get('ssl') || 'prefer'
      }

      // Determine default port based on protocol
      let defaultPort = 5432
      if (protocol === 'mysql') {
        defaultPort = 3306
      }

      return {
        hostname: hostname || '',
        port: port ? parseInt(port, 10) : defaultPort,
        database: database || '',
        username: username || '',
        password: password || '',
        sslMode,
      }
    } catch (error) {
      return { error: 'Failed to parse connection string' }
    }
  }

  const handleImportConnectionString = (connectionString: string) => {
    const parsed = parseConnectionString(connectionString)

    if ('error' in parsed) {
      return parsed.error
    }

    // Populate form fields
    if (parsed.hostname) form.setValue('hostname', parsed.hostname)
    if (parsed.port) form.setValue('port', parsed.port)
    if (parsed.database) form.setValue('database', parsed.database)
    if (parsed.username) form.setValue('username', parsed.username)
    if (parsed.password) form.setValue('password', parsed.password)
    if (parsed.sslMode) form.setValue('sslMode', parsed.sslMode)

    return null
  }

  return (
    <div className="p-8">
      <SettingsForm form={form} onSubmit={onSubmit} className="max-w-5xl">
        <SettingsHeader>Create New Database</SettingsHeader>

        {/* Section 1: Basic Information */}
        <SettingsSection
          title="Basic Information"
          description={
            <div className="space-y-2 text-sm">
              <p className="text-zinc-600 dark:text-zinc-400">
                General details about the database server
              </p>
              <button
                type="button"
                onClick={() => setShowConnectionStringModal(true)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                Have a Connection String?
              </button>
            </div>
          }
        >
          <FieldStack>
            <Field>
              <Label>Database Name</Label>
              <Input
                {...register('name', { required: 'Database name is required' })}
                placeholder="Production Database"
              />
              {errors.name && <ErrorMessage>{errors.name.message}</ErrorMessage>}
            </Field>

            <Field>
              <Label>Server Type</Label>
              <Select {...register('databaseType')} onChange={handleDatabaseTypeChange}>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
              </Select>
            </Field>

            <Field>
              <Label>Environment (optional)</Label>
              <Description>Classify this database by environment</Description>
              <Select {...register('environment')}>
                <option value="">No environment</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="testing">Testing</option>
                <option value="development">Development</option>
              </Select>
            </Field>
          </FieldStack>
        </SettingsSection>

        <SettingsDivider />

        {/* Section 2: Connection Method */}
        <SettingsSection
          title="Connection Method"
          description={
            <div className="space-y-3 text-sm">
              <p className="text-zinc-600 dark:text-zinc-400">
                Choose how to connect to your database server
              </p>
              {!useSsh && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/30">
                  <div className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Firewall Configuration
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Configure your firewall to allow traffic from:{' '}
                    <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded font-mono text-xs">
                      {import.meta.env.VITE_SOURCE_IP_1}
                    </code>
                    {' and '}
                    <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded font-mono text-xs">
                      {import.meta.env.VITE_SOURCE_IP_2}
                    </code>
                  </p>
                </div>
              )}
              {useSsh && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    SSH Tunnel Setup
                  </div>
                  <ol className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 list-decimal list-inside">
                    <li>
                      Add our public key to your bastion host's{' '}
                      <code className="bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-xs">
                        authorized_keys
                      </code>{' '}
                      file
                    </li>
                    <li>Ensure your database accepts connections from the bastion host</li>
                    <li>
                      The database hostname should be accessible from the bastion (can be{' '}
                      <code className="bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-xs">
                        localhost
                      </code>{' '}
                      if database is on bastion)
                    </li>
                  </ol>
                </div>
              )}
            </div>
          }
        >
          <FieldStack>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => form.setValue('useSsh', false)}
                className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                  !useSsh
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                    : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                } hover:border-blue-400 dark:hover:border-blue-600`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      !useSsh
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  >
                    {!useSsh && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      Direct Connection
                    </div>
                    <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      Connect directly to your database server
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => form.setValue('useSsh', true)}
                className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                  useSsh
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                    : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                } hover:border-blue-400 dark:hover:border-blue-600`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      useSsh
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  >
                    {useSsh && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">SSH Tunnel</div>
                    <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      Connect through a bastion/jump host for additional security
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {useSsh && (
              <>
                <Field>
                  <Label>SSH Host</Label>
                  <Input
                    {...register('sshHost', {
                      required: useSsh ? 'SSH host is required when SSH tunnel is enabled' : false,
                    })}
                    placeholder="bastion.example.com"
                  />
                  {errors.sshHost && <ErrorMessage>{errors.sshHost.message}</ErrorMessage>}
                </Field>

                <Field>
                  <Label>SSH Port</Label>
                  <Input
                    type="number"
                    {...register('sshPort', {
                      valueAsNumber: true,
                      min: { value: 1, message: 'Port must be between 1 and 65535' },
                      max: { value: 65535, message: 'Port must be between 1 and 65535' },
                    })}
                  />
                  {errors.sshPort && <ErrorMessage>{errors.sshPort.message}</ErrorMessage>}
                </Field>

                <Field>
                  <Label>SSH User</Label>
                  <Input
                    {...register('sshUser', {
                      required: useSsh ? 'SSH user is required when SSH tunnel is enabled' : false,
                    })}
                    placeholder="ubuntu"
                  />
                  {errors.sshUser && <ErrorMessage>{errors.sshUser.message}</ErrorMessage>}
                </Field>

                <div className="rounded-lg border border-zinc-950/10 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900">
                  <Text className="font-medium">SSH Public Key</Text>
                  <Text className="mt-1 text-sm">
                    Add our public key to your SSH server's authorized_keys file
                  </Text>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" plain onClick={handleCopySshKey}>
                      Copy Key
                    </Button>
                  </div>
                  <div className="mt-3 rounded bg-zinc-900 p-3 font-mono text-xs text-white dark:bg-zinc-950 break-all">
                    {import.meta.env.VITE_SSH_PUBLIC_KEY || 'SSH key not configured'}
                  </div>
                </div>
              </>
            )}
          </FieldStack>
        </SettingsSection>

        <SettingsDivider />

        {/* Section 3: Database Details */}
        <SettingsSection
          title="Database Details"
          description={
            <div className="space-y-2 text-sm">
              <p className="text-zinc-600 dark:text-zinc-400">
                Connection information for the database
              </p>
            </div>
          }
        >
          <FieldStack>
            <Field>
              <Label>Hostname / IP Address</Label>
              <Input
                {...register('hostname', { required: 'Hostname is required' })}
                placeholder="db.example.com"
              />
              {errors.hostname && <ErrorMessage>{errors.hostname.message}</ErrorMessage>}
            </Field>

            <Field>
              <Label>Port</Label>
              <Input
                type="number"
                {...register('port', {
                  required: 'Port is required',
                  valueAsNumber: true,
                  min: { value: 1, message: 'Port must be between 1 and 65535' },
                  max: { value: 65535, message: 'Port must be between 1 and 65535' },
                })}
              />
              {errors.port && <ErrorMessage>{errors.port.message}</ErrorMessage>}
            </Field>

            <Field>
              <Label>Database Name</Label>
              <Input
                {...register('database', { required: 'Database name is required' })}
                placeholder={databaseType === 'mysql' ? 'mydb' : 'postgres'}
              />
              {errors.database && <ErrorMessage>{errors.database.message}</ErrorMessage>}
            </Field>

            <Field>
              <Label>SSL Mode</Label>
              <Select {...register('sslMode')}>
                <option value="disable">Disabled - No encryption</option>
                <option value="prefer">Prefer (recommended) - Use SSL if available</option>
                <option value="require">Required - Always use SSL</option>
              </Select>
            </Field>
          </FieldStack>
        </SettingsSection>

        <SettingsDivider />

        {/* Section 4: Default Profile */}
        <SettingsSection
          title="Default Account"
          description={
            <div className="space-y-3 text-sm">
              <p className="text-zinc-600 dark:text-zinc-400">
                Database credentials for your default access account
              </p>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  About Accounts
                </div>
                <div className="space-y-2 text-zinc-700 dark:text-zinc-300">
                  <p>
                    Accounts represent different sets of database credentials with specific
                    permissions (e.g., <span className="font-medium">readonly</span>,{' '}
                    <span className="font-medium">write</span>,{' '}
                    <span className="font-medium">admin</span>).
                  </p>
                  <p>
                    We'll create a default account for you now. You can add additional accounts with
                    different credentials and permissions later.
                  </p>
                  <p>
                    Each account uses its own database username and password, allowing you to grant
                    granular access to team members.
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Important:</strong> Access control must be configured on your database
                    server. VaultSQL helps prevent unauthorized queries, but the database enforces
                    the actual permissions.
                  </p>
                </div>
              </div>
            </div>
          }
        >
          <FieldStack>
            <Field>
              <Label>Access Level</Label>
              <Description>The level of database access this account provides</Description>
              <Select {...register('accessLevel')}>
                <option value="readonly">Read-only - Can query data but cannot modify it</option>
                <option value="write">Write - Can query and modify data</option>
                <option value="admin">Admin - Full access including schema changes</option>
              </Select>
            </Field>

            <Field>
              <Label>Database Username</Label>
              <Input
                {...register('username', { required: 'Username is required' })}
                placeholder="postgres"
              />
              {errors.username && <ErrorMessage>{errors.username.message}</ErrorMessage>}
            </Field>

            <Field>
              <Label>Database Password</Label>
              <Input
                type="password"
                {...register('password', { required: 'Password is required' })}
                placeholder="••••••••"
              />
              {errors.password && <ErrorMessage>{errors.password.message}</ErrorMessage>}
            </Field>
          </FieldStack>
        </SettingsSection>

        <SettingsDivider />

        {/* Error Display */}
        {createDatabase.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
            <Text className="font-medium text-red-900 dark:text-red-100">
              Failed to create database
            </Text>
            <Text className="mt-1 text-sm text-red-800 dark:text-red-200">
              {createDatabase.error?.message || 'An unexpected error occurred'}
            </Text>
          </div>
        )}

        <SettingsFooter
          submitLabel="Create Server"
          showReset={false}
          isSubmitting={createDatabase.isPending}
          message={
            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
              We'll verify connectivity before creating the server
            </Text>
          }
        />
      </SettingsForm>

      <ConnectionStringModal
        open={showConnectionStringModal}
        onClose={() => setShowConnectionStringModal(false)}
        onImport={handleImportConnectionString}
      />
    </div>
  )
}

function ConnectionStringModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (connectionString: string) => string | null
}) {
  const [connectionString, setConnectionString] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleImport = () => {
    setError(null)
    const errorMessage = onImport(connectionString)
    if (errorMessage) {
      setError(errorMessage)
    } else {
      setConnectionString('')
      onClose()
    }
  }

  const handleClose = () => {
    setConnectionString('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Import Connection String</DialogTitle>
      <DialogDescription>
        Paste a PostgreSQL or MySQL connection string to automatically populate the database
        details.
      </DialogDescription>
      <DialogBody>
        <Field>
          <Label>Connection String</Label>
          <Description>
            Format: <code className="text-xs">protocol://user:password@host:port/database</code>
          </Description>
          <Textarea
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
            placeholder="postgresql://username:password@localhost:5432/mydb?sslmode=require"
            rows={4}
          />
        </Field>
        {error && <Text className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</Text>}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleImport} disabled={!connectionString.trim()}>
          Import
        </Button>
      </DialogActions>
    </Dialog>
  )
}
