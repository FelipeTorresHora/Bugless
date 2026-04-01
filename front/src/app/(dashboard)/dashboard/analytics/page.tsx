'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  dashboardApi,
  type AnalyticsRange,
  type AnalyticsSummaryResponse,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

import { ActivityChart } from '../../_components/activity-chart'
import { IssuesByTypeChart } from '../../_components/issues-by-type-chart'
import { PageHeader } from '../../_components/page-header'
import { RepositoryStatsTable } from '../../_components/repository-stats-table'
import { TopIssuesList } from '../../_components/top-issues-list'

const EMPTY_ANALYTICS: AnalyticsSummaryResponse = {
  range: '30d',
  summary: {
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
    successRate: 0,
    failureRate: 0,
    avgProcessingMs: 0,
    codeVolume: 0,
  },
  kpis: [],
  activity: [],
  issuesByType: [],
  topIssues: [],
  repositoryStats: [],
}

const timeRangeOptions: { value: AnalyticsRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<AnalyticsRange>('30d')
  const [analytics, setAnalytics] = useState<AnalyticsSummaryResponse>(EMPTY_ANALYTICS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadAnalytics() {
      setLoading(true)
      const response = await dashboardApi.getAnalyticsSummary(timeRange)
      if (!active) return

      if (!response.success || !response.data) {
        setAnalytics(EMPTY_ANALYTICS)
        setError(response.message || 'Failed to load analytics')
        setLoading(false)
        return
      }

      setAnalytics(response.data)
      setError(null)
      setLoading(false)
    }

    loadAnalytics()

    return () => {
      active = false
    }
  }, [timeRange])

  async function handleExportCsv() {
    const response = await dashboardApi.exportAnalyticsCsv(timeRange)

    if (!response.success || !response.data) {
      setError(response.message || 'Failed to export analytics CSV')
      return
    }

    const blob = new Blob([response.data.csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = response.data.filename
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const filteredActivityData = analytics.activity

  return (
    <>
      <PageHeader
        title='Analytics'
        description='Detailed insights into your code review metrics.'
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className='mb-6 flex flex-wrap items-center gap-2'
      >
        {timeRangeOptions.map((option) => (
          <Button
            key={option.value}
            variant={timeRange === option.value ? 'secondary' : 'ghost'}
            size='sm'
            onClick={() => setTimeRange(option.value)}
            className={cn(
              'h-8 px-3 text-xs',
              timeRange === option.value && 'bg-primary/10 text-primary hover:bg-primary/20',
            )}
          >
            {option.label}
          </Button>
        ))}
        <Button size='sm' variant='outline' onClick={handleExportCsv}>
          Export CSV
        </Button>
      </motion.div>

      {loading ? (
        <p className='text-sm text-text-secondary'>Loading analytics...</p>
      ) : error ? (
        <p className='text-sm text-text-secondary'>{error}</p>
      ) : (
        <div className='grid gap-4 lg:grid-cols-2'>
          <div className='lg:col-span-2'>
            <ActivityChart data={filteredActivityData} />
          </div>

          <IssuesByTypeChart data={analytics.issuesByType} />
          <TopIssuesList data={analytics.topIssues} />

          <div className='lg:col-span-2'>
            <RepositoryStatsTable data={analytics.repositoryStats} />
          </div>
        </div>
      )}
    </>
  )
}
