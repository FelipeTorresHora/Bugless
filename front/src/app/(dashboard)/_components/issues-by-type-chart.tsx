'use client'

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

import type { IssuesByType } from '@/lib/dashboard-types'

interface IssuesByTypeChartProps {
  data: IssuesByType[]
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: IssuesByType }>
}) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload

  return (
    <div className='rounded-lg border border-border bg-surface-elevated px-3 py-2 shadow-lg'>
      <p className='text-sm font-medium'>{data.type}</p>
      <p className='text-xs text-text-secondary'>{data.count} issues</p>
    </div>
  )
}

export function IssuesByTypeChart({ data }: IssuesByTypeChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={cn(
        'rounded-xl border border-border bg-surface p-4',
      )}
    >
      <h3 className='mb-4 text-sm font-medium'>Issues by Category</h3>
      <div className='h-[200px]'>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={data} layout='vertical' margin={{ left: 0, right: 16 }}>
            <XAxis type='number' hide />
            <YAxis
              type='category'
              dataKey='type'
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#a1a1a1', fontSize: 12 }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey='count' radius={[0, 4, 4, 0]} barSize={24}>
              {data.map((entry) => (
                <Cell key={entry.type} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
