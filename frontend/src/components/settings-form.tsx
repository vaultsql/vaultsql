import clsx from 'clsx'
import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { FormProvider, useFormContext } from 'react-hook-form'
import { Button } from '@/components/catalyst/button'
import { Divider } from '@/components/catalyst/divider'
import { Heading, Subheading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'

// Layout context for horizontal vs stacked sections
type SettingsLayoutMode = 'horizontal' | 'stacked'

const SettingsLayoutContext = createContext<SettingsLayoutMode>('horizontal')

function useSettingsLayout() {
  return useContext(SettingsLayoutContext)
}

// -----------------------------------------------------------------------------
// SettingsForm - Main form wrapper with react-hook-form integration
// -----------------------------------------------------------------------------

interface SettingsFormProps<T extends FieldValues> {
  form: UseFormReturn<T>
  onSubmit: (data: T) => void | Promise<void>
  children: ReactNode
  className?: string
  /** Force horizontal (2-col) or stacked layout for all sections */
  layout?: SettingsLayoutMode
}

export function SettingsForm<T extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  layout = 'horizontal',
}: SettingsFormProps<T>) {
  return (
    <SettingsLayoutContext.Provider value={layout}>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className={clsx('max-w-3xl', className)}>
          {children}
        </form>
      </FormProvider>
    </SettingsLayoutContext.Provider>
  )
}

// -----------------------------------------------------------------------------
// SettingsPage - Wrapper for non-form settings pages (action-only)
// -----------------------------------------------------------------------------

interface SettingsPageProps {
  children: ReactNode
  className?: string
  layout?: SettingsLayoutMode
}

export function SettingsPage({ children, className, layout = 'horizontal' }: SettingsPageProps) {
  return (
    <SettingsLayoutContext.Provider value={layout}>
      <div className={clsx('max-w-3xl', className)}>{children}</div>
    </SettingsLayoutContext.Provider>
  )
}

// -----------------------------------------------------------------------------
// SettingsHeader - Page heading with divider
// -----------------------------------------------------------------------------

interface SettingsHeaderProps {
  children: ReactNode
}

export function SettingsHeader({ children }: SettingsHeaderProps) {
  return (
    <>
      <Heading>{children}</Heading>
      <Divider className="my-6 mt-4" />
    </>
  )
}

// -----------------------------------------------------------------------------
// SettingsSection - Row with label/description on left, control on right
// -----------------------------------------------------------------------------

interface SettingsSectionProps {
  title: string
  description?: ReactNode
  children: ReactNode
  /** Override the default layout for this section */
  layout?: SettingsLayoutMode
}

export function SettingsSection({
  title,
  description,
  children,
  layout: layoutOverride,
}: SettingsSectionProps) {
  const contextLayout = useSettingsLayout()
  const layout = layoutOverride ?? contextLayout

  const isHorizontal = layout === 'horizontal'

  return (
    <section className={clsx('grid gap-x-8 gap-y-6', isHorizontal && 'sm:grid-cols-2')}>
      <div className="space-y-1">
        <Subheading>{title}</Subheading>
        {description && <Text>{description}</Text>}
      </div>
      <div>{children}</div>
    </section>
  )
}

// -----------------------------------------------------------------------------
// SettingsDivider - Consistent divider between sections
// -----------------------------------------------------------------------------

interface SettingsDividerProps {
  soft?: boolean
}

export function SettingsDivider({ soft = true }: SettingsDividerProps) {
  return <Divider className="my-10" soft={soft} />
}

// -----------------------------------------------------------------------------
// SettingsFooter - Form actions (submit/reset buttons)
// -----------------------------------------------------------------------------

interface SettingsFooterProps {
  submitLabel?: string
  resetLabel?: string
  showReset?: boolean
  isSubmitting?: boolean
  message?: ReactNode
}

export function SettingsFooter({
  submitLabel = 'Save changes',
  resetLabel = 'Reset',
  showReset = true,
  isSubmitting,
  message,
}: SettingsFooterProps) {
  const form = useFormContext()
  const submitting = isSubmitting ?? form?.formState?.isSubmitting

  return (
    <div className="flex items-center justify-between gap-4">
      {message && <div className="flex-1">{message}</div>}
      <div className={clsx('flex gap-4', !message && 'ml-auto')}>
        {showReset && (
          <Button type="reset" plain disabled={submitting}>
            {resetLabel}
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// SettingsActions - For non-form action rows (e.g., "Connect Slack" button)
// -----------------------------------------------------------------------------

interface SettingsActionsProps {
  title: string
  description?: ReactNode
  children: ReactNode
  /** Override the default layout for this section */
  layout?: SettingsLayoutMode
}

export function SettingsActions({
  title,
  description,
  children,
  layout: layoutOverride,
}: SettingsActionsProps) {
  const contextLayout = useSettingsLayout()
  const layout = layoutOverride ?? contextLayout

  const isHorizontal = layout === 'horizontal'

  return (
    <section className={clsx('grid gap-x-8 gap-y-6', isHorizontal && 'sm:grid-cols-2')}>
      <div className="space-y-1">
        <Subheading>{title}</Subheading>
        {description && <Text>{description}</Text>}
      </div>
      <div>{children}</div>
    </section>
  )
}

// -----------------------------------------------------------------------------
// SettingsGroup - Group multiple sections under a heading (for mixed forms)
// -----------------------------------------------------------------------------

interface SettingsGroupProps {
  children: ReactNode
  className?: string
}

export function SettingsGroup({ children, className }: SettingsGroupProps) {
  return <div className={clsx('space-y-0', className)}>{children}</div>
}

// -----------------------------------------------------------------------------
// FieldError - Display field-level errors from react-hook-form
// -----------------------------------------------------------------------------

interface FieldErrorProps {
  name: string
}

export function FieldError({ name }: FieldErrorProps) {
  const form = useFormContext()
  const error = form?.formState?.errors?.[name]

  if (!error?.message) return null

  return <p className="mt-2 text-sm text-red-600 dark:text-red-500">{String(error.message)}</p>
}

// -----------------------------------------------------------------------------
// FieldStack - Vertical stack for multiple inputs in one section
// -----------------------------------------------------------------------------

interface FieldStackProps {
  children: ReactNode
  className?: string
}

export function FieldStack({ children, className }: FieldStackProps) {
  return <div className={clsx('space-y-4', className)}>{children}</div>
}
