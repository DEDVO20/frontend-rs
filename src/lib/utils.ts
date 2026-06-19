import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return formatDate(date)
}
