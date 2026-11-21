import axios from 'axios'
import { toast } from 'sonner'
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
    // La empresa del usuario fue inactivada con la sesión abierta: se cierra la sesión
    if (err.response?.status === 403 && err.response.data?.code === 'COMPANY_INACTIVE') {
      toast.error(err.response.data.error)
      await useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  },
)
