import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-primary-600', className)} />
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-64">
      <Spinner className="w-8 h-8" />
    </div>
  )
}
