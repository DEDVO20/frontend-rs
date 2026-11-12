import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

// La sesión viaja en cookies httpOnly: withCredentials hace que el navegador las envíe
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/',
  withCredentials: true,
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && original && !original._retry) {
      original._retry = true
      const refreshed = await useAuthStore.getState().refresh()
      if (refreshed) return api(original)
      useAuthStore.getState().clearSession()
    }
    return Promise.reject(err)
  },
)
