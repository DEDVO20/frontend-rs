import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

// Los tokens de sesión viven SOLO en cookies httpOnly emitidas por el backend:
// el JavaScript no puede leerlos. Aquí solo se guarda el perfil (no es credencial;
// el backend valida rol y permisos en cada request).
const http = axios.create({ baseURL: BASE, withCredentials: true })

interface User {
  id: string
  email: string
  full_name?: string
  role: string
  companyId: string | null
  modules: string[]
}

interface AuthState {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  refresh: () => Promise<boolean>
  logout: () => Promise<void>
  clearSession: () => void
}

// Varias peticiones pueden recibir 401 a la vez: un solo refresh compartido
let refreshing: Promise<boolean> | null = null

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      login: async (email, password) => {
        const { data } = await http.post('/auth/login', { email, password })
        const meRes = await http.get('/auth/me')
        set({ user: { ...data.user, ...meRes.data } })
      },

      refresh: () => {
        refreshing ??= http
          .post('/auth/refresh')
          .then(() => true)
          .catch(() => false)
          .finally(() => { refreshing = null })
        return refreshing
      },

      logout: async () => {
        try {
          await http.post('/auth/logout')
        } catch {
          // aunque falle la red, se limpia la sesión local
        }
        set({ user: null })
      },

      clearSession: () => set({ user: null }),
    }),
    {
      name: 'rs-auth',
      version: 1,
      partialize: (s) => ({ user: s.user }),
      // v0 guardaba access/refresh token en localStorage: se descartan
      migrate: (persisted) => ({ user: (persisted as { user?: User | null })?.user ?? null }),
    },
  ),
)
