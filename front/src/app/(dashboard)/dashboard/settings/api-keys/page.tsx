'use client'

import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  dashboardApi,
  type ApiKeyRecord,
  type ProfileResponse,
} from '@/lib/api'

import { PageHeader } from '../../../_components/page-header'

type Provider = 'GEMINI' | 'OPENAI' | 'CLAUDE'

const providers: Provider[] = ['GEMINI', 'OPENAI', 'CLAUDE']

const providerHelp: Record<Provider, { docsUrl: string; keyHint: string; notes: string }> = {
  GEMINI: {
    docsUrl: 'https://aistudio.google.com/app/apikey',
    keyHint: 'Formato esperado: AIza...',
    notes: 'Recomendado para começar no MVP por estabilidade atual.',
  },
  OPENAI: {
    docsUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'Formato esperado: sk-...',
    notes: 'Boa qualidade geral e latência consistente.',
  },
  CLAUDE: {
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'Formato esperado: sk-ant-...',
    notes: 'Ótimo para análises longas e contexto extenso.',
  },
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('pt-BR')
  } catch {
    return value
  }
}

export default function ApiKeysSettingsPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [provider, setProvider] = useState<Provider>('GEMINI')
  const [keyValue, setKeyValue] = useState('')
  const [keyName, setKeyName] = useState('')
  const [preferredProvider, setPreferredProvider] = useState<Provider>('GEMINI')

  async function loadApiKeys() {
    setLoading(true)
    const [keysResponse, profileResponse] = await Promise.all([
      dashboardApi.listApiKeys(),
      dashboardApi.getProfile(),
    ])

    if (!keysResponse.success || !keysResponse.data) {
      setKeys([])
      setError(keysResponse.message || 'Falha ao carregar API keys')
      setLoading(false)
      return
    }

    if (profileResponse.success && profileResponse.data) {
      setProfile(profileResponse.data)
      if (profileResponse.data.activeProvider) {
        setPreferredProvider(profileResponse.data.activeProvider)
      }
    } else {
      setProfile(null)
    }

    setKeys(keysResponse.data)
    if (!profileResponse.data?.activeProvider && keysResponse.data.length > 0) {
      setPreferredProvider(keysResponse.data[0].provider)
    }
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadApiKeys()
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  async function handleCreateOrUpdateKey() {
    if (!keyValue.trim()) {
      setError('Informe a API key antes de salvar.')
      return
    }

    setSaving(true)
    const response = await dashboardApi.createApiKey({
      provider,
      key: keyValue.trim(),
      keyName: keyName.trim() || undefined,
    })

    if (!response.success) {
      setError(response.message || 'Falha ao salvar API key')
      setSaving(false)
      return
    }

    setMessage('API key salva com sucesso.')
    setError(null)
    setKeyValue('')
    await loadApiKeys()
    setSaving(false)
  }

  async function handleSetActive(nextProvider: Provider) {
    const response = await dashboardApi.setActiveProvider(nextProvider)
    if (!response.success) {
      setError(response.message || 'Falha ao ativar provider')
      return
    }

    setMessage(`${nextProvider} definido como provider ativo.`)
    setError(null)
    await loadApiKeys()
  }

  async function handleRevalidate(nextProvider: Provider) {
    const response = await dashboardApi.revalidateApiKey(nextProvider)
    if (!response.success) {
      setError(response.message || 'Falha ao revalidar API key')
      return
    }

    setMessage(`API key ${nextProvider} revalidada com sucesso.`)
    setError(null)
    await loadApiKeys()
  }

  async function handleDelete(nextProvider: Provider) {
    const response = await dashboardApi.deleteApiKey(nextProvider)
    if (!response.success) {
      setError(response.message || 'Falha ao remover API key')
      return
    }

    setMessage(`API key ${nextProvider} removida.`)
    setError(null)
    await loadApiKeys()
  }

  async function handlePreferredProviderSave() {
    const response = await dashboardApi.setActiveProvider(preferredProvider)
    if (!response.success) {
      setError(response.message || 'Falha ao salvar provider preferido')
      return
    }

    setMessage(`Provider preferido atualizado para ${preferredProvider}.`)
    setError(null)
    await loadApiKeys()
  }

  return (
    <>
      <PageHeader
        title='Settings · API Keys'
        description='Gerencie chave ativa, validação e status de uso por provider.'
      />

      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Adicionar / atualizar API key</CardTitle>
            <CardDescription>
              Suporte multi-provider ativo (Gemini, OpenAI e Claude).
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='grid gap-3 md:grid-cols-3'>
              <select
                className='h-9 rounded-md border border-input bg-transparent px-3 text-sm'
                value={provider}
                onChange={(event) => setProvider(event.target.value as Provider)}
              >
                {providers.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <Input
                placeholder='Nome da key (opcional)'
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
              />
              <Input
                placeholder='Cole sua API key'
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
              />
            </div>
            <Button
              type='button'
              disabled={saving}
              onClick={handleCreateOrUpdateKey}
            >
              {saving ? 'Salvando...' : 'Salvar key'}
            </Button>
            <p className='text-xs text-text-secondary'>
              {providerHelp[provider].keyHint}
            </p>
            <p className='text-xs text-text-secondary'>
              {providerHelp[provider].notes}
            </p>
            <a
              href={providerHelp[provider].docsUrl}
              target='_blank'
              rel='noreferrer'
              className='inline-block text-xs text-primary hover:underline'
            >
              Abrir documentação para gerar key de {provider}
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider em uso na revisão</CardTitle>
            <CardDescription>
              O worker usa sempre o provider marcado como ativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-text-secondary'>
              Atual:{' '}
              <span className='font-medium text-foreground'>
                {profile?.activeProvider || 'Nenhum provider ativo'}
              </span>
            </p>
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <select
                className='h-9 rounded-md border border-input bg-transparent px-3 text-sm'
                value={preferredProvider}
                onChange={(event) =>
                  setPreferredProvider(event.target.value as Provider)
                }
              >
                {keys.map((item) => (
                  <option key={`preferred-${item.provider}`} value={item.provider}>
                    {item.provider}
                  </option>
                ))}
              </select>
              <Button
                type='button'
                size='sm'
                variant='outline'
                disabled={!keys.length}
                onClick={handlePreferredProviderSave}
              >
                Salvar provider preferido
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comparação rápida de providers</CardTitle>
            <CardDescription>
              Referência para escolha inicial (ajuste conforme sua necessidade).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto'>
              <table className='w-full min-w-[520px] text-sm'>
                <thead>
                  <tr className='border-b border-border text-left text-text-secondary'>
                    <th className='py-2 pr-3'>Provider</th>
                    <th className='py-2 pr-3'>Foco</th>
                    <th className='py-2 pr-3'>Latência</th>
                    <th className='py-2'>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className='border-b border-border/60'>
                    <td className='py-2 pr-3'>GEMINI</td>
                    <td className='py-2 pr-3'>Custo/benefício</td>
                    <td className='py-2 pr-3'>Baixa</td>
                    <td className='py-2'>Recomendado para começar</td>
                  </tr>
                  <tr className='border-b border-border/60'>
                    <td className='py-2 pr-3'>OPENAI</td>
                    <td className='py-2 pr-3'>Qualidade geral</td>
                    <td className='py-2 pr-3'>Média</td>
                    <td className='py-2'>Bom equilíbrio para PRs complexos</td>
                  </tr>
                  <tr>
                    <td className='py-2 pr-3'>CLAUDE</td>
                    <td className='py-2 pr-3'>Contexto longo</td>
                    <td className='py-2 pr-3'>Média</td>
                    <td className='py-2'>Excelente para revisões extensas</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keys configuradas</CardTitle>
            <CardDescription>
              Chaves mascaradas; segredos nunca são expostos.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {loading ? (
              <p className='text-sm text-text-secondary'>Carregando API keys...</p>
            ) : keys.length === 0 ? (
              <p className='text-sm text-text-secondary'>
                Nenhuma API key encontrada para este usuário.
              </p>
            ) : (
              keys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className='rounded-lg border border-border bg-surface p-4'
                >
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='space-x-2'>
                      <Badge variant='outline'>{apiKey.provider}</Badge>
                      {apiKey.isActive && <Badge>Ativa</Badge>}
                      {!apiKey.isValid && (
                        <Badge variant='destructive'>Inválida</Badge>
                      )}
                    </div>
                    <p className='text-sm text-text-secondary'>{apiKey.maskedKey}</p>
                  </div>

                  <div className='mt-3 grid gap-1 text-xs text-text-secondary md:grid-cols-3'>
                    <p>Nome: {apiKey.keyName || '-'}</p>
                    <p>Última validação: {formatDate(apiKey.lastValidatedAt)}</p>
                    <p>Último uso: {formatDate(apiKey.lastUsedAt)}</p>
                  </div>

                  <div className='mt-3 flex flex-wrap gap-2'>
                    {!apiKey.isActive && (
                      <Button
                        type='button'
                        size='sm'
                        variant='secondary'
                        onClick={() => handleSetActive(apiKey.provider)}
                      >
                        Definir ativa
                      </Button>
                    )}
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => handleRevalidate(apiKey.provider)}
                    >
                      Revalidar
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='destructive'
                      onClick={() => handleDelete(apiKey.provider)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {message && <p className='text-sm text-primary'>{message}</p>}
        {error && (
          <p className='text-sm text-destructive'>
            {error}. Se necessário, faça login novamente em <code>/auth/login</code>.
          </p>
        )}
      </div>
    </>
  )
}
