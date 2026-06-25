import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { router } from './router'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,         // 5 minutos — no refetch si los datos tienen menos de 5 min
      gcTime: 10 * 60_000,            // 10 minutos en cache antes de limpiar
      refetchOnWindowFocus: false,     // no refrescar al volver a la pestaña
      refetchOnReconnect: true,        // sí refrescar si se reconecta internet
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  </StrictMode>,
)
