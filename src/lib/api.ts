import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/' })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshed = await useAuthStore.getState().refresh()
      if (refreshed) {
        original.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`
        return api(original)
      }
      useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  },
)
