'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  dashboardApi,
  type AnalyticsSummaryResponse,
  type ProfileResponse,
  type ProjectStatsResponse,
} from '@/lib/api'

import { ActivityChart } from '../_components/activity-chart'
import { KpiGrid } from '../_components/kpi-grid'
import { PageHeader } from '../_components/page-header'
import { UsageWidget } from '../_components/usage-widget'

function getFirstName(fullName?: string | null) {
  if (!fullName) return 'Developer'
  return fullName.trim().split(' ')[0] || 'Developer'
}

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

export default function DashboardPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsSummaryResponse>(EMPTY_ANALYTICS)
  const [projects, setProjects] = useState<ProjectStatsResponse>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      setLoading(true)

      const [profileResponse, analyticsResponse, projectsResponse] = await Promise.all([
        dashboardApi.getProfile(),
        dashboardApi.getAnalyticsSummary('30d'),
        dashboardApi.getProjectsStats(),
      ])

      if (!active) return

      if (profileResponse.success && profileResponse.data) {
        setProfile(profileResponse.data)
      } else {
        setProfile(null)
      }

      if (analyticsResponse.success && analyticsResponse.data) {
        setAnalytics(analyticsResponse.data)
      } else {
        setAnalytics(EMPTY_ANALYTICS)
      }

      if (projectsResponse.success && projectsResponse.data) {
        setProjects(projectsResponse.data)
      } else {
        setProjects([])
      }

      if (!analyticsResponse.success) {
        setError(analyticsResponse.message || 'Falha ao carregar analytics')
      } else {
        setError(null)
      }

      setLoading(false)
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [])

  const setupSteps = useMemo(
    () => [
      {
        title: 'Sessão web ativa',
        done: true,
        href: '/dashboard',
      },
      {
        title: 'API key ativa (BYOK)',
        done: Boolean(profile?.hasApiKey),
        href: '/dashboard/settings/api-keys',
      },
      {
        title: 'Primeira review enviada',
        done: analytics.summary.total > 0,
        href: '/dashboard/reviews',
      },
    ],
    [analytics.summary.total, profile?.hasApiKey]
  )

  return (
    <>
      <PageHeader
        title={`Welcome back, ${getFirstName(profile?.name)}`}
        description="Here's what's happening with your code reviews."
      />

      <div className='space-y-8'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Onboarding BYOK</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {setupSteps.map((step) => (
              <div key={step.title} className='flex items-center justify-between gap-3 rounded-md border border-border p-3'>
                <div className='flex items-center gap-2'>
                  <Badge variant={step.done ? 'default' : 'outline'}>{step.done ? 'OK' : 'Pendente'}</Badge>
                  <span className='text-sm'>{step.title}</span>
                </div>
                {!step.done && (
                  <Link href={step.href} className='text-xs text-primary hover:underline'>
                    Ir para ajuste
                  </Link>
                )}
              </div>
            ))}
            {error && <p className='text-xs text-text-secondary'>{error}</p>}
          </CardContent>
        </Card>

        <UsageWidget />

        {loading ? (
          <p className='text-sm text-text-secondary'>Carregando métricas do dashboard...</p>
        ) : analytics.kpis.length === 0 ? (
          <Card>
            <CardContent className='py-8 text-sm text-text-secondary'>
              Sem dados de review ainda. Envie uma submissão pela CLI para popular métricas reais.
            </CardContent>
          </Card>
        ) : (
          <KpiGrid kpis={analytics.kpis} />
        )}

        <ActivityChart data={analytics.activity} />

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Projetos e estatísticas reais</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className='text-sm text-text-secondary'>
                Nenhum projeto com submissões encontrado ainda.
              </p>
            ) : (
              <div className='space-y-2'>
                {projects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    className='grid grid-cols-1 gap-2 rounded-md border border-border p-3 text-sm md:grid-cols-5'
                  >
                    <p className='font-medium md:col-span-2'>{project.repositoryUrl || project.name}</p>
                    <p className='text-text-secondary'>Submissões: {project.stats.submissionsTotal}</p>
                    <p className='text-text-secondary'>Issues: {project.stats.totalIssues}</p>
                    <p className='text-text-secondary'>
                      Score médio:{' '}
                      {project.stats.averageScore !== null ? `${project.stats.averageScore}/100` : '-'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
