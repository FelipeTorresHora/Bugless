'use client'

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Bug,
  CheckCircle,
  Clock,
  GitBranch,
  GitPullRequest,
  Lightning,
  Shield,
  Spinner,
  XCircle,
} from '@phosphor-icons/react/dist/ssr'

import type { Review, ReviewMode, ReviewStatus } from '@/lib/dashboard-types'

const statusConfig: Record<
  ReviewStatus,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    className: 'text-success',
  },
  in_progress: {
    label: 'In Progress',
    icon: Spinner,
    className: 'text-warning',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className: 'text-error',
  },
}

const modeLabels: Record<ReviewMode, string> = {
  pr: 'Pull Request',
  commit: 'Commit',
  uncommitted: 'Uncommitted',
  custom: 'Custom',
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface ReviewRowProps {
  review: Review
}

export function ReviewRow({ review }: ReviewRowProps) {
  const status = statusConfig[review.status]
  const StatusIcon = status.icon
  const hasReviewDetail = Boolean(review.reviewId)

  const content = (
    <div
      className={cn(
        'group flex items-center gap-4 rounded-lg border border-border bg-surface p-4',
        'transition-colors hover:border-border-hover',
      )}
    >
      <div className={cn('shrink-0', status.className)}>
        <StatusIcon
          size={20}
          weight={review.status === 'in_progress' ? 'bold' : 'fill'}
          className={review.status === 'in_progress' ? 'animate-spin' : ''}
        />
      </div>

      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <p className='truncate text-sm font-medium'>{review.title}</p>
        </div>
        <div className='mt-1 flex items-center gap-3 text-xs text-text-muted'>
          <span className='flex items-center gap-1'>
            <GitPullRequest size={12} />
            {review.repository}
          </span>
          <span className='flex items-center gap-1'>
            <GitBranch size={12} />
            {review.branch}
          </span>
        </div>
      </div>

      <div className='hidden items-center gap-2 sm:flex'>
        <Badge variant='outline' className='text-xs'>
          {modeLabels[review.mode]}
        </Badge>
        <Badge variant='outline' className='capitalize text-xs'>
          {review.preset}
        </Badge>
        {review.provider && (
          <Badge variant='outline' className='text-xs'>
            {review.provider}
          </Badge>
        )}
      </div>

      <div className='hidden items-center gap-4 text-xs lg:flex'>
        {review.issuesFound > 0 && (
          <span className='flex items-center gap-1 text-text-secondary'>
            <Bug size={14} />
            {review.issuesFound}
          </span>
        )}
        {review.securityIssues > 0 && (
          <span className='flex items-center gap-1 text-error'>
            <Shield size={14} />
            {review.securityIssues}
          </span>
        )}
        {review.performanceIssues > 0 && (
          <span className='flex items-center gap-1 text-warning'>
            <Lightning size={14} />
            {review.performanceIssues}
          </span>
        )}
      </div>

      <div className='shrink-0 text-right text-xs text-text-muted'>
        <div className='flex items-center gap-1'>
          <Clock size={12} />
          {review.reviewTime}
        </div>
        <div className='mt-1'>{formatDate(review.createdAt)}</div>
      </div>
    </div>
  )

  if (!hasReviewDetail) {
    return content
  }

  return (
    <Link href={`/dashboard/reviews/${review.reviewId}`} className='block'>
      {content}
    </Link>
  )
}
