import { cn } from '@/lib/utils'

type Color = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'teal' | 'orange'

interface Props {
  label: string
  color?: Color
  className?: string
}

const colors: Record<Color, string> = {
  green:  'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  yellow: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  red:    'bg-red-50 text-red-700 ring-red-600/20',
  blue:   'bg-blue-50 text-blue-700 ring-blue-600/20',
  gray:   'bg-slate-50 text-slate-600 ring-slate-500/20',
  teal:   'bg-primary-50 text-primary-700 ring-primary-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
}

export function Badge({ label, color = 'gray', className }: Props) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ring-inset', colors[color], className)}>
      {label}
    </span>
  )
}
