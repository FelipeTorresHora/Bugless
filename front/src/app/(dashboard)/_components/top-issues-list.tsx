'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Bug, Lightning, PaintBrush, Shield } from '@phosphor-icons/react/dist/ssr'
import { motion } from 'framer-motion'

import type { IssueCategory, TopIssue } from '@/lib/dashboard-types'

interface TopIssuesListProps {
  data: TopIssue[]
}

const categoryConfig: Record<
  IssueCategory,
  { icon: typeof Bug; color: string; bgColor: string }
> = {
  bug: { icon: Bug, color: 'text-error', bgColor: 'bg-error/10' },
  security: { icon: Shield, color: 'text-warning', bgColor: 'bg-warning/10' },
  performance: { icon: Lightning, color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  style: { icon: PaintBrush, color: 'text-text-muted', bgColor: 'bg-text-muted/10' },
}

export function TopIssuesList({ data }: TopIssuesListProps) {
  const sortedData = [...data].sort((a, b) => b.count - a.count)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className={cn(
        'rounded-xl border border-border bg-surface p-4',
      )}
    >
      <h3 className='mb-4 text-sm font-medium'>Top Issues Found</h3>
      <div className='space-y-2'>
        {sortedData.slice(0, 6).map((issue, index) => {
          const config = categoryConfig[issue.category]
          const Icon = config.icon

          return (
            <motion.div
              key={issue.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.05 }}
              className='flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-hover'
            >
              <div className={cn('flex size-8 items-center justify-center rounded-lg', config.bgColor)}>
                <Icon size={16} className={config.color} />
              </div>
              <span className='flex-1 text-sm'>{issue.type}</span>
              <Badge variant='outline' className='tabular-nums'>
                {issue.count}
              </Badge>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
