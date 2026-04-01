'use client'

import type { KpiData } from '@/lib/dashboard-types'
import { KpiCard } from './kpi-card'

interface KpiGridProps {
  kpis: KpiData[]
}

export function KpiGrid({ kpis }: KpiGridProps) {
  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {kpis.map((kpi, index) => (
        <KpiCard key={kpi.id} {...kpi} index={index} />
      ))}
    </div>
  )
}
