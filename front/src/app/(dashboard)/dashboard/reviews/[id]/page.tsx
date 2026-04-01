'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import { useParams } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type ReviewDetailsResponse, dashboardApi } from '@/lib/api'
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'

import { PageHeader } from '../../../_components/page-header'

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('pt-BR')
  } catch {
    return value
  }
}

function getProcessingTime(metadata: Record<string, unknown> | null): string {
  if (!metadata || typeof metadata !== 'object') return '-'

  const analytics = metadata.analytics
  if (!analytics || typeof analytics !== 'object') return '-'

  const processingMs = (analytics as Record<string, unknown>).processingMs
  if (typeof processingMs !== 'number') return '-'

  return `${(processingMs / 1000).toFixed(1)}s`
}

export default function ReviewDetailsPage() {
  const params = useParams<{ id: string }>()
  const reviewId = params.id

  const [review, setReview] = useState<ReviewDetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadReview() {
      setLoading(true)
      const response = await dashboardApi.getReviewById(reviewId)
      if (!active) return

      if (!response.success || !response.data) {
        setReview(null)
        setError(response.message || 'Falha ao carregar detalhes da review')
        setLoading(false)
        return
      }

      setReview(response.data)
      setError(null)
      setLoading(false)
    }

    if (reviewId) {
      loadReview()
    }

    return () => {
      active = false
    }
  }, [reviewId])

  const repository = useMemo(
    () => review?.submission.project.repositoryUrl || review?.submission.project.name || '-',
    [review]
  )

  return (
    <>
      <PageHeader
        title='Review Details'
        description='Detalhes completos da análise gerada para a submissão.'
      />

      <div className='mb-4'>
        <Link href='/dashboard/reviews' className='inline-flex items-center gap-2 text-sm text-primary hover:underline'>
          <ArrowLeft size={16} />
          Voltar para histórico
        </Link>
      </div>

      {loading ? (
        <p className='text-sm text-text-secondary'>Carregando review...</p>
      ) : error || !review ? (
        <p className='text-sm text-text-secondary'>{error || 'Review não encontrada'}</p>
      ) : (
        <div className='space-y-4'>
          <Card>
            <CardHeader>
              <div className='flex flex-wrap items-center gap-2'>
                <CardTitle className='text-base'>{repository}</CardTitle>
                <Badge variant='outline'>{review.submission.statusSubmission.name}</Badge>
                {review.submission.aiProvider && (
                  <Badge variant='outline'>{review.submission.aiProvider}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className='grid gap-2 text-sm text-text-secondary md:grid-cols-2'>
              <p>Submission ID: {review.submission.id}</p>
              <p>Review ID: {review.id}</p>
              <p>Criado em: {formatDate(review.createdAt)}</p>
              <p>Tempo de processamento: {getProcessingTime(review.submission.metadata)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Resumo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='whitespace-pre-wrap text-sm leading-relaxed'>
                {review.summary || 'Sem resumo disponível.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Issues detectadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='whitespace-pre-wrap text-sm leading-relaxed'>
                {review.detectedIssues || 'Nenhuma issue detectada.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Sugestões de melhoria</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='whitespace-pre-wrap text-sm leading-relaxed'>
                {review.suggestedChanges || 'Sem sugestões adicionais.'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
