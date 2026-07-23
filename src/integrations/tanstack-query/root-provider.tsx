import { QueryClient } from '@tanstack/react-query'
import { queryClientDefaults } from './query-policy'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: queryClientDefaults(typeof window === 'undefined'),
  })

  return {
    queryClient,
  }
}
export default function TanstackQueryProvider() {}
