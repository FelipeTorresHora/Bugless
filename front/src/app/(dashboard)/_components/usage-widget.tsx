'use client'

import { useEffect, useMemo, useState } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { dashboardApi, type BillingUsageResponse } from '@/lib/api'

function formatPeriodEnd(dateIso: string): string {
  try {
    return new Date(dateIso).toLocaleDateString('pt-BR')
  } catch {
    return dateIso
  }
}

export function UsageWidget() {
  const [usage, setUsage] = useState<BillingUsageResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadUsage() {
      setLoading(true)
      const response = await dashboardApi.getBillingUsage()
      if (!active) return

      if (!response.success || !response.data) {
        setUsage(null)
        setError(response.message || 'Failed to load usage')
        setLoading(false)
        return
      }

      setUsage(response.data)
      setError(null)
      setLoading(false)
    }

    loadUsage()

    return () => {
      active = false
    }
  }, [])

  const progress = useMemo(() => {
    if (!usage || usage.isUnlimited || usage.reviewsLimit <= 0) {
      return 0
    }

    return Math.min(100, Math.round((usage.reviewsCount / usage.reviewsLimit) * 100))
  }, [usage])

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base'>Uso mensal</CardTitle>
        <CardDescription>Controle tecnico de quota (sem pagamento ativo)</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {loading ? (
          <p className='text-sm text-text-secondary'>Carregando uso...</p>
        ) : error ? (
          <p className='text-sm text-text-secondary'>
            {error}. Refaça o login para restaurar a sessão web.
          </p>
        ) : usage ? (
          <>
            <div className='flex items-end justify-between gap-4'>
              <p className='text-2xl font-semibold'>
                {usage.reviewsCount}
                {!usage.isUnlimited && <span className='text-base text-text-secondary'>/{usage.reviewsLimit}</span>}
              </p>
              <p className='text-xs text-text-secondary'>
                Renova em {formatPeriodEnd(usage.periodEnd)}
              </p>
            </div>
            {!usage.isUnlimited && (
              <>
                <div className='h-2 rounded-full bg-surface'>
                  <div
                    className='h-2 rounded-full bg-primary transition-[width]'
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className='text-xs text-text-secondary'>
                  {usage.remainingReviews} reviews restantes no plano FREE.
                </p>
              </>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
