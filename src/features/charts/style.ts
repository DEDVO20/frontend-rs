import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'

export const INTERNAL_ROLES = ['admin', 'rs_admin', 'rs_staff', 'contador']

/**
 * Colores de serie validados (scripts/validate_palette.js del skill dataviz):
 * azul de marca + dorado con croma suficiente, con su paso propio en claro y oscuro.
 */
export const PALETTE = {
  light: { facturado: '#3d6bc1', notas: '#a87d1e', recaudo: '#a87d1e', grid: 'rgba(26,37,69,0.08)', axis: '#64748b' },
  dark:  { facturado: '#5c86d0', notas: '#b98d2a', recaudo: '#b98d2a', grid: 'rgba(255,247,228,0.08)', axis: 'rgba(255,247,228,0.6)' },
}

export type Palette = (typeof PALETTE)['light']

/** Estilo de las gráficas según quién mira: back-office (siempre claro) o portal del cliente (claro/oscuro) */
export interface ChartStyle {
  colors: Palette
  isDark: boolean
  isInternal: boolean
  cardCls: string
  titleCls: string
  mutedCls: string
}

export function useChartStyle(): ChartStyle {
  const role = useAuthStore(s => s.user?.role ?? '')
  const theme = useThemeStore(s => s.theme)
  const isInternal = INTERNAL_ROLES.includes(role)
  // La app interna siempre es clara (AppLayout fuerza data-theme="light")
  const isDark = !isInternal && theme === 'dark'
  return {
    colors: isDark ? PALETTE.dark : PALETTE.light,
    isDark,
    isInternal,
    cardCls: isInternal
      ? 'bg-white border border-slate-200 rounded-2xl p-5'
      : 'rounded-2xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/5 dark:ring-white/5 p-5',
    titleCls: isInternal ? 'text-slate-900' : 'text-navy-900 dark:text-cream-100 font-display',
    mutedCls: isInternal ? 'text-slate-500' : 'text-navy-900/55 dark:text-cream-100/55',
  }
}

export function chartInputCls(isInternal: boolean) {
  return cn(
    'px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary-500',
    isInternal
      ? 'border-slate-200 bg-white text-slate-700'
      : 'border-navy-900/10 bg-white text-navy-900 dark:border-white/10 dark:bg-navy-800 dark:text-cream-100',
  )
}

export const SYNC_ROLES = ['admin', 'rs_admin', 'contador']
