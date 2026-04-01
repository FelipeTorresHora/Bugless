'use client'

import { cn } from '@/lib/utils'
import { Bug, GitBranch, Lightning, Shield } from '@phosphor-icons/react/dist/ssr'
import { motion } from 'framer-motion'

import type { RepoStats } from '@/lib/dashboard-types'

interface RepositoryStatsTableProps {
  data: RepoStats[]
}

export function RepositoryStatsTable({ data }: RepositoryStatsTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className={cn(
        'rounded-xl border border-border bg-surface p-4',
      )}
    >
      <h3 className='mb-4 text-sm font-medium'>Repository Breakdown</h3>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border text-left text-xs text-text-muted'>
              <th className='pb-3 font-medium'>Repository</th>
              <th className='pb-3 text-right font-medium'>Reviews</th>
              <th className='pb-3 text-right font-medium'>
                <span className='flex items-center justify-end gap-1'>
                  <Bug size={12} />
                  Bugs
                </span>
              </th>
              <th className='pb-3 text-right font-medium'>
                <span className='flex items-center justify-end gap-1'>
                  <Shield size={12} />
                  Security
                </span>
              </th>
              <th className='pb-3 text-right font-medium'>
                <span className='flex items-center justify-end gap-1'>
                  <Lightning size={12} />
                  Perf
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((repo, index) => (
              <motion.tr
                key={repo.repo}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className='border-b border-border/50 last:border-0'
              >
                <td className='py-3'>
                  <span className='flex items-center gap-2'>
                    <GitBranch size={14} className='text-text-muted' />
                    <span className='font-medium'>{repo.repo}</span>
                  </span>
                </td>
                <td className='py-3 text-right tabular-nums'>{repo.reviews}</td>
                <td className='py-3 text-right tabular-nums text-error'>{repo.bugs}</td>
                <td className='py-3 text-right tabular-nums text-warning'>{repo.security}</td>
                <td className='py-3 text-right tabular-nums text-purple-400'>{repo.performance}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
