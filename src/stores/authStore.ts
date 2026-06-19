import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

interface User {
  id: string
  email: string
  role: string
  companyId: string | null
  modules: string[]
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  login: (email: string, password: string) => Promise<void>
  refresh: () => Promise<boolean>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken:  null,
      refreshToken: null,
      user:         null,

      login: async (email, password) => {
        const { data } = await axios.post(`${BASE}/auth/login`, { email, password })
        const meRes = await axios.get(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        })
        set({
          accessToken:  data.access_token,
          refreshToken: data.refresh_token,
          user: { ...data.user, ...meRes.data },
        })
      },

      refresh: async () => {
        const rt = get().refreshToken
        if (!rt) return false
        try {
          const { data } = await axios.post(`${BASE}/auth/refresh`, { refresh_token: rt })
          set({ accessToken: data.access_token, refreshToken: data.refresh_token })
          return true
        } catch {
          return false
        }
      },

      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'rs-auth',
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user }),
    },
  ),
)
