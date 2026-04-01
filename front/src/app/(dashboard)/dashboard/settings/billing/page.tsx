'use client'

import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  dashboardApi,
  type BillingSubscriptionResponse,
  type BillingUsageResponse,
} from '@/lib/api'

import { PageHeader } from '../../../_components/page-header'

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('pt-BR')
  } catch {
    return value
  }
}

export default function BillingSettingsPage() {
  const [usage, setUsage] = useState<BillingUsageResponse | null>(null)
  const [subscription, setSubscription] = useState<BillingSubscriptionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadBilling() {
    setLoading(true)
    const [usageResponse, subscriptionResponse] = await Promise.all([
      dashboardApi.getBillingUsage(),
      dashboardApi.getBillingSubscription(),
    ])

    if (!usageResponse.success || !usageResponse.data) {
      setUsage(null)
      setSubscription(null)
      setError(usageResponse.message || 'Falha ao carregar uso do billing')
      setLoading(false)
      return
    }

    if (!subscriptionResponse.success || !subscriptionResponse.data) {
      setUsage(null)
      setSubscription(null)
      setError(subscriptionResponse.message || 'Falha ao carregar subscription')
      setLoading(false)
      return
    }

    setUsage(usageResponse.data)
    setSubscription(subscriptionResponse.data)
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadBilling()
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <PageHeader
        title='Settings · Billing'
        description='Status de plano e quota técnica (checkout real será habilitado na fase final).'
      />

      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Plano atual</CardTitle>
            <CardDescription>Sem cobrança ativa até a Semana 9.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {loading ? (
              <p className='text-sm text-text-secondary'>Carregando dados de billing...</p>
            ) : !usage || !subscription ? (
              <p className='text-sm text-text-secondary'>
                Não foi possível carregar billing. Faça login novamente se a sessão expirar.
              </p>
            ) : (
              <>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge>{subscription.plan}</Badge>
                  <Badge variant='outline'>{subscription.status}</Badge>
                  {subscription.cancelAtPeriodEnd && (
                    <Badge variant='destructive'>Cancelamento agendado</Badge>
                  )}
                </div>
                <div className='grid gap-2 text-sm text-text-secondary md:grid-cols-2'>
                  <p>Período atual: {formatDate(subscription.currentPeriodStart)} até {formatDate(subscription.currentPeriodEnd)}</p>
                  <p>
                    Uso: {usage.isUnlimited ? 'Ilimitado' : `${usage.reviewsCount}/${usage.reviewsLimit}`}
                  </p>
                  <p>
                    Restante: {usage.isUnlimited ? 'Ilimitado' : usage.remainingReviews}
                  </p>
                  <p>Renovação técnica: {formatDate(usage.periodEnd)}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upgrade para Pro</CardTitle>
            <CardDescription>
              Fluxo de checkout com Stripe será concentrado na fase final do projeto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type='button' disabled>
              Em breve
            </Button>
          </CardContent>
        </Card>

        {error && <p className='text-sm text-destructive'>{error}</p>}
      </div>
    </>
  )
}
