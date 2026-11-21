import { type ComponentProps } from 'react'
import { ResponsiveContainer } from 'recharts'
import { ErrorBoundary } from './ErrorBoundary'

export function ChartContainer(props: ComponentProps<typeof ResponsiveContainer>) {
  return <ErrorBoundary><ResponsiveContainer {...props} /></ErrorBoundary>
}
