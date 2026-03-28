import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Divider } from '@/components/catalyst/divider'
import { Description, Label } from '@/components/catalyst/fieldset'
import { Heading, Subheading } from '@/components/catalyst/heading'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { getAuthToken } from '@/lib/auth'
import { useAuditLogs, useUpdateWorkspaceSettings, useWorkspaceSettings } from '@/queries/settings'
import { usePageTitle } from '@/webapp/hooks'

export function AuditSettingsPage() {
  usePageTitle('Audit Settings')
  const { data: settings, isLoading, error } = useWorkspaceSettings()
  const updateSettings = useUpdateWorkspaceSettings()
  const [isDownloading, setIsDownloading] = useState(false)

  // Audit log viewer state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'application',
    'system_queries',
    'data_browser_queries',
    'custom_queries',
  ])
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  const { data: auditLogData, isLoading: isLoadingLogs } = useAuditLogs(
    selectedCategories,
    currentPage,
    pageSize,
  )

  const handleAuditEnabledChange = (checked: boolean) => {
    updateSettings.mutate({ audit_enabled: checked })
  }

  const handleStoreQueriesChange = (checked: boolean) => {
    updateSettings.mutate({ audit_store_queries: checked })
  }

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, category])
    } else {
      setSelectedCategories(selectedCategories.filter((c) => c !== category))
    }
    setCurrentPage(1) // Reset to first page when filters change
  }

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  const formatEventType = (eventType: string) => {
    // Convert snake_case to Title Case
    return eventType
      .split('.')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const handleDownloadAuditLog = async () => {
    setIsDownloading(true)
    try {
      const token = getAuthToken()
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)

      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const url = `${apiUrl}/api/audit/audit-log/download?start_date=${startDateStr}&end_date=${endDateStr}`

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to download audit log')
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `audit_log_from_${startDateStr}_to_${endDateStr}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <Heading>Audit Log</Heading>
        <Divider className="my-6 mt-4" />
        <Text>Loading settings...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl">
        <Heading>Audit Log</Heading>
        <Divider className="my-6 mt-4" />
        <Text className="text-red-600">Failed to load settings. Please try again.</Text>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      <Heading>Audit Log</Heading>
      <Divider className="my-6 mt-4" />

      <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Subheading>Audit Logging</Subheading>
          <Text>
            Configure what query activity is recorded in the audit log for compliance and security
            monitoring.
          </Text>
        </div>
        <div className="space-y-4">
          <CheckboxField>
            <Checkbox
              name="audit_enabled"
              checked={settings?.audit_enabled ?? false}
              onChange={handleAuditEnabledChange}
              disabled={updateSettings.isPending}
            />
            <Label>Enable audit log</Label>
            <Description>Record query execution events to the audit log</Description>
          </CheckboxField>
          <CheckboxField>
            <Checkbox
              name="audit_store_queries"
              checked={settings?.audit_store_queries ?? false}
              onChange={handleStoreQueriesChange}
              disabled={updateSettings.isPending || !settings?.audit_enabled}
            />
            <Label>Log full SQL queries</Label>
            <Description>
              Store the complete SQL query text in audit logs. When disabled, only query hashes are
              recorded.
            </Description>
          </CheckboxField>
        </div>
      </section>

      <Divider className="my-10" soft />

      <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Subheading>Export Audit Log</Subheading>
          <Text>Download a CSV export of your workspace's audit log for the last 30 days.</Text>
        </div>
        <div>
          <Button onClick={handleDownloadAuditLog} disabled={isDownloading}>
            {isDownloading ? 'Downloading...' : 'Download 30-day audit log'}
          </Button>
        </div>
      </section>

      <Divider className="my-10" soft />

      <section className="space-y-6">
        <div className="space-y-1">
          <Subheading>Audit Log Viewer</Subheading>
          <Text>Browse and filter audit log entries by event type.</Text>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Text className="text-sm font-semibold">Event Types</Text>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CheckboxField>
                <Checkbox
                  name="category_application"
                  checked={selectedCategories.includes('application')}
                  onChange={(checked) => handleCategoryChange('application', checked)}
                />
                <Label>Application events</Label>
                <Description>Key approvals, user joins, account access changes</Description>
              </CheckboxField>
              <CheckboxField>
                <Checkbox
                  name="category_system_queries"
                  checked={selectedCategories.includes('system_queries')}
                  onChange={(checked) => handleCategoryChange('system_queries', checked)}
                />
                <Label>System queries</Label>
                <Description>Schema loading and system operations</Description>
              </CheckboxField>
              <CheckboxField>
                <Checkbox
                  name="category_data_browser_queries"
                  checked={selectedCategories.includes('data_browser_queries')}
                  onChange={(checked) => handleCategoryChange('data_browser_queries', checked)}
                />
                <Label>Data browser queries</Label>
                <Description>Direct user actions in data browser</Description>
              </CheckboxField>
              <CheckboxField>
                <Checkbox
                  name="category_custom_queries"
                  checked={selectedCategories.includes('custom_queries')}
                  onChange={(checked) => handleCategoryChange('custom_queries', checked)}
                />
                <Label>Custom queries</Label>
                <Description>Worksheet and ad-hoc queries</Description>
              </CheckboxField>
            </div>
          </div>

          {selectedCategories.length === 0 ? (
            <div className="py-8 text-center">
              <Text className="text-muted-foreground">
                Select at least one event type to view audit logs.
              </Text>
            </div>
          ) : (
            <>
              {isLoadingLogs ? (
                <div className="py-8 text-center">
                  <Text>Loading audit logs...</Text>
                </div>
              ) : auditLogData && auditLogData.items.length === 0 ? (
                <div className="py-8 text-center">
                  <Text className="text-muted-foreground">No audit log entries found.</Text>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeader>Timestamp</TableHeader>
                          <TableHeader>User</TableHeader>
                          <TableHeader>Event Type</TableHeader>
                          <TableHeader>Server</TableHeader>
                          <TableHeader>Database</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {auditLogData?.items.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{formatTimestamp(entry.created_at)}</TableCell>
                            <TableCell>{entry.actor_email || entry.actor_type}</TableCell>
                            <TableCell>{formatEventType(entry.event_type)}</TableCell>
                            <TableCell>{entry.database_name || '-'}</TableCell>
                            <TableCell>{entry.database || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {auditLogData && auditLogData.total > 0 && (
                    <div className="flex items-center justify-between">
                      <Text className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * pageSize + 1}-
                        {Math.min(currentPage * pageSize, auditLogData.total)} of{' '}
                        {auditLogData.total} entries
                      </Text>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={!auditLogData || currentPage * pageSize >= auditLogData.total}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
