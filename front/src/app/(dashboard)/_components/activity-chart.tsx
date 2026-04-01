'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { motion } from 'framer-motion'

import type { ActivityDataPoint } from '@/lib/dashboard-types'

interface ActivityChartProps {
  data: ActivityDataPoint[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className='rounded-lg border border-border bg-surface-elevated px-4 py-3 shadow-lg'>
      <p className='mb-2 text-sm font-medium text-foreground'>{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className='flex items-center gap-2 text-sm'>
          <div
            className='size-2.5 rounded-full'
            style={{ backgroundColor: entry.color }}
          />
          <span className='text-text-secondary'>
            {entry.name === 'reviews' ? 'Reviews' : 'Bugs'}:
          </span>
          <span className='font-medium text-foreground'>{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className='border-border/50'>
        <CardHeader className='pb-2'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-lg font-semibold'>Activity Overview</CardTitle>
            <div className='flex items-center gap-4 text-sm'>
              <div className='flex items-center gap-2'>
                <div className='size-2.5 rounded-full bg-primary' />
                <span className='text-text-secondary'>Reviews</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='size-2.5 rounded-full bg-error' />
                <span className='text-text-secondary'>Bugs</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='h-[320px] w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart
                data={data}
                margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id='reviewsGradient' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#ff6b35' stopOpacity={0.3} />
                    <stop offset='100%' stopColor='#ff6b35' stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id='bugsGradient' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#ef4444' stopOpacity={0.3} />
                    <stop offset='100%' stopColor='#ef4444' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray='3 3'
                  stroke='#262626'
                  vertical={false}
                />
                <XAxis
                  dataKey='date'
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b6b6b', fontSize: 12 }}
                  dy={10}
                  interval='preserveStartEnd'
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b6b6b', fontSize: 12 }}
                  dx={-10}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type='monotone'
                  dataKey='reviews'
                  name='reviews'
                  stroke='#ff6b35'
                  strokeWidth={2}
                  fill='url(#reviewsGradient)'
                />
                <Area
                  type='monotone'
                  dataKey='bugs'
                  name='bugs'
                  stroke='#ef4444'
                  strokeWidth={2}
                  fill='url(#bugsGradient)'
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
