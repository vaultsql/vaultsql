import { useQuery } from '@tanstack/react-query'
import { useAppClient } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'
import type { components } from '@/lib/openapi'

export type Notification = components['schemas']['NotificationResponse']
export type Cta = components['schemas']['CtaResponse']

export function useNotifications() {
  const client = useAppClient()

  return useQuery({
    queryKey: ['notifications'],
    staleTime: 2 * 60 * 1000, // 2 minutes - notifications update more frequently
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/notification/', {
        signal,
      })
      if (data) return data.notifications
      throw new Error(getErrorMessage(error))
    },
  })
}
