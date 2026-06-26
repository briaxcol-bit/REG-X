import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 min
      gcTime: 1000 * 60 * 10,         // 10 min
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status
        // Don't retry 4xx errors
        if (status && status >= 400 && status < 500) return false
        return failureCount < 3
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 0,
      networkMode: 'offlineFirst',
      onError: (error: unknown) => {
        const message = (error as { message?: string })?.message ?? 'Error inesperado'
        toast.error(message)
      },
    },
  },
})
