import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { PageHeader } from '../../_components/page-header'

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title='Settings'
        description='Gerencie API keys e uso do plano BYOK.'
      />

      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Configure e valide sua chave ativa para revisão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href='/dashboard/settings/api-keys' className='text-sm text-primary hover:underline'>
              Abrir gerenciamento de API keys
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>
              Veja uso mensal e status interno da assinatura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href='/dashboard/settings/billing' className='text-sm text-primary hover:underline'>
              Abrir visão de billing
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
