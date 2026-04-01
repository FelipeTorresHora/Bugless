'use client'

import { cn } from '@/lib/utils'
import {
  Bug,
  Clock,
  Code,
  Shield,
  TrendDown,
  TrendUp,
} from '@phosphor-icons/react/dist/ssr'
import { motion } from 'framer-motion'

import type { KpiData } from '@/lib/dashboard-types'

const iconMap = {
  code: Code,
  bug: Bug,
  clock: Clock,
  shield: Shield,
}

interface KpiCardProps extends KpiData {
  index: number
}

export function KpiCard({
  title,
  value,
  trend,
  trendDirection,
  trendIsPositive,
  icon,
  index,
}: KpiCardProps) {
  const Icon = iconMap[icon]
  const TrendIcon = trendDirection === 'up' ? TrendUp : TrendDown

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div
        className={cn(
          'rounded-xl border border-border bg-surface p-4',
          'transition-colors duration-200',
          'hover:border-border-hover',
        )}
      >
        <div className='flex items-center justify-between'>
          <p className='text-sm text-text-secondary'>{title}</p>
          <div
            className={cn(
              'flex size-8 items-center justify-center rounded-lg',
              'bg-primary/10',
            )}
          >
            <Icon size={16} weight='duotone' className='text-primary' />
          </div>
        </div>

        <div className='mt-4 flex items-end justify-between'>
          <p className='text-2xl font-semibold tracking-tight'>{value}</p>
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trendIsPositive ? 'text-success' : 'text-error',
            )}
          >
            <TrendIcon size={12} weight='bold' />
            <span>{trend}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
