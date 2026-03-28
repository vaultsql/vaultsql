import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900">
      <div className="text-center max-w-md px-4">
        <div className="text-6xl font-bold text-zinc-300 dark:text-zinc-700">404</div>
        <Heading level={1} className="mt-4">
          Page not found
        </Heading>
        <Text className="mt-2">The page you're looking for doesn't exist or has been moved.</Text>
        <div className="mt-6">
          <Button href="/">Go to home</Button>
        </div>
      </div>
    </div>
  )
}
