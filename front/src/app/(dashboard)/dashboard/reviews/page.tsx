'use client'

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { dashboardApi, type ProjectStatsResponse, type SubmissionsListResponse } from '@/lib/api'
import type { ReviewStatus } from '@/lib/dashboard-types'
import { cn } from '@/lib/utils'
import { FunnelSimple, MagnifyingGlass } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

import { PageHeader } from '../../_components/page-header'
import { ReviewRow } from '../../_components/review-row'

type FilterStatus = 'all' | ReviewStatus
type ProviderFilter = 'all' | 'GEMINI' | 'OPENAI' | 'CLAUDE'

const filterOptions: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'failed', label: 'Failed' },
]

const providerOptions: { value: ProviderFilter; label: string }[] = [
  { value: 'all', label: 'All providers' },
  { value: 'GEMINI', label: 'Gemini' },
  { value: 'OPENAI', label: 'OpenAI' },
  { value: 'CLAUDE', label: 'Claude' },
]

function mapStatusToBackend(status: FilterStatus): 'PENDING' | 'COMPLETED' | 'FAILED' | undefined {
  if (status === 'completed') return 'COMPLETED'
  if (status === 'failed') return 'FAILED'
  if (status === 'in_progress') return 'PENDING'
  return undefined
}

export default function ReviewsPage() {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [provider, setProvider] = useState<ProviderFilter>('all')
  const [projectId, setProjectId] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<SubmissionsListResponse>({
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  })
  const [projects, setProjects] = useState<ProjectStatsResponse>([])

  useEffect(() => {
    let active = true

    async function loadProjects() {
      const projectsResponse = await dashboardApi.getProjectsStats()
      if (!active) return

      if (projectsResponse.success && projectsResponse.data) {
        setProjects(projectsResponse.data)
      } else {
        setProjects([])
      }
    }

    loadProjects()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadReviews() {
      setLoading(true)
      const reviewsResponse = await dashboardApi.listSubmissions({
        page,
        limit: 12,
        projectId: projectId === 'all' ? undefined : projectId,
        status: mapStatusToBackend(filter),
        provider: provider === 'all' ? undefined : provider,
      })

      if (!active) return

      if (!reviewsResponse.success || !reviewsResponse.data) {
        setResponse({
          items: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        })
        setError(reviewsResponse.message || 'Failed to load review history')
        setLoading(false)
        return
      }

      setResponse(reviewsResponse.data)
      setError(null)
      setLoading(false)
    }

    loadReviews()

    return () => {
      active = false
    }
  }, [filter, page, projectId, provider])

  const filteredReviews = useMemo(() => response.items.filter((review) => {
    const matchesFilter = filter === 'all' || review.status === filter
    const matchesSearch =
      search === '' ||
      review.title.toLowerCase().includes(search.toLowerCase()) ||
      review.repository.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  }), [filter, response.items, search])

  return (
    <>
      <PageHeader
        title='Reviews'
        description='View and manage your code reviews.'
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'
      >
        <div className='relative'>
          <MagnifyingGlass
            size={16}
            className='absolute left-3 top-1/2 -translate-y-1/2 text-text-muted'
          />
          <input
            type='text'
            placeholder='Search reviews...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-4 text-sm',
              'placeholder:text-text-muted',
              'transition-colors focus:border-primary focus:outline-none',
              'sm:w-64',
            )}
          />
        </div>

        <div className='flex items-center gap-2'>
          <FunnelSimple size={16} className='text-text-muted' />
          <div className='flex flex-wrap gap-1'>
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={filter === option.value ? 'secondary' : 'ghost'}
                size='sm'
                onClick={() => {
                  setFilter(option.value)
                  setPage(1)
                }}
                className={cn(
                  'h-8 px-3 text-xs',
                  filter === option.value && 'bg-primary/10 text-primary hover:bg-primary/20',
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <select
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value as ProviderFilter)
              setPage(1)
            }}
            className='h-8 rounded-md border border-input bg-transparent px-2 text-xs'
          >
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value)
              setPage(1)
            }}
            className='h-8 rounded-md border border-input bg-transparent px-2 text-xs'
          >
            <option value='all'>All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className='space-y-2'
      >
        {loading ? (
          <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16'>
            <p className='text-sm text-text-muted'>Loading review history...</p>
          </div>
        ) : error ? (
          <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16'>
            <p className='text-sm text-text-muted'>{error}</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16'>
            <p className='text-sm text-text-muted'>No reviews found</p>
          </div>
        ) : (
          filteredReviews.map((review, index) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <ReviewRow review={review} />
            </motion.div>
          ))
        )}
      </motion.div>

      {response.pagination.totalPages > 1 && (
        <div className='mt-4 flex items-center justify-center gap-2'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <p className='text-xs text-text-muted'>
            Page {response.pagination.page} of {response.pagination.totalPages}
          </p>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={page >= response.pagination.totalPages}
            onClick={() =>
              setPage((current) =>
                Math.min(response.pagination.totalPages, current + 1)
              )
            }
          >
            Next
          </Button>
        </div>
      )}

      {!loading && filteredReviews.length > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className='mt-4 text-center text-xs text-text-muted'
        >
          Showing {filteredReviews.length} of {response.pagination.total} reviews
        </motion.p>
      )}
    </>
  )
}
