import type {
  ActivityDataPoint,
  IssuesByType,
  KpiData,
  RepoStats,
  Review,
  TopIssue,
} from './dashboard-types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
const IS_DEV = process.env.NODE_ENV !== 'production'
const DASHBOARD_TOKEN_KEY = 'bugless_dashboard_token'

interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  errors?: Record<string, string[] | undefined>
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: Record<string, unknown>
}

let accessTokenMemory: string | null = null
let refreshPromise: Promise<boolean> | null = null

function getDevStoredToken(): string | null {
  if (!IS_DEV || typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem(DASHBOARD_TOKEN_KEY)
}

function getAccessToken(): string | null {
  return accessTokenMemory || getDevStoredToken()
}

function setAccessToken(token: string | null) {
  accessTokenMemory = token

  if (!IS_DEV || typeof window === 'undefined') {
    return
  }

  if (token) {
    window.localStorage.setItem(DASHBOARD_TOKEN_KEY, token.trim())
    return
  }

  window.localStorage.removeItem(DASHBOARD_TOKEN_KEY)
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }
    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

async function parseApiResponse<T = unknown>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return (await response.json()) as ApiResponse<T>
  }

  if (response.ok) {
    return {
      success: true,
      message: 'Request successful',
    }
  }

  return {
    success: false,
    message: `Request failed with status ${response.status}`,
  }
}

function buildJsonFetchOptions(options: ApiOptions = {}, authToken?: string): RequestInit {
  const { body, ...restOptions } = options

  return {
    ...restOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(restOptions.headers || {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, buildJsonFetchOptions(options))
    return await parseApiResponse<T>(response)
  } catch (error) {
    console.error('API Error:', error)
    return {
      success: false,
      message: 'Network error. Please try again.',
    }
  }
}

type SessionAuthPayload = {
  accessToken: string
  accessTokenExpiresIn: string
  user: {
    id: string
    name: string
    email: string
  }
}

async function refreshAccessTokenInternal(): Promise<boolean> {
  try {
    const response = await apiClient<SessionAuthPayload>('/auth/session/refresh', {
      method: 'POST',
    })

    if (!response.success || !response.data?.accessToken) {
      setAccessToken(null)
      return false
    }

    setAccessToken(response.data.accessToken)
    return true
  } catch (error) {
    console.error('Refresh session error:', error)
    setAccessToken(null)
    return false
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessTokenInternal().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

async function ensureAccessToken(): Promise<string | null> {
  const current = getAccessToken()
  if (current) return current

  const refreshed = await refreshAccessToken()
  if (!refreshed) return null
  return getAccessToken()
}

async function apiClientWithAuth<T = unknown>(
  endpoint: string,
  options: ApiOptions = {},
  retry = true
): Promise<ApiResponse<T>> {
  const token = await ensureAccessToken()

  if (!token) {
    return {
      success: false,
      message: 'Missing dashboard session',
    }
  }

  try {
    const response = await fetch(
      `${API_URL}${endpoint}`,
      buildJsonFetchOptions(options, token)
    )

    if (response.status === 401 && retry) {
      const refreshed = await refreshAccessToken()
      if (!refreshed) {
        return {
          success: false,
          message: 'Session expired',
        }
      }

      return apiClientWithAuth<T>(endpoint, options, false)
    }

    return await parseApiResponse<T>(response)
  } catch (error) {
    console.error('API Auth Error:', error)
    return {
      success: false,
      message: 'Network error. Please try again.',
    }
  }
}

interface LoginResponse {
  token: string
  user: {
    id: string
    name: string
    email: string
  }
}

interface CliLoginResponse {
  message: string
}

export type ProfileResponse = {
  id: string
  name: string
  email: string
  hasApiKey: boolean
  activeProvider: 'GEMINI' | 'OPENAI' | 'CLAUDE' | null
  plan: 'FREE' | 'PRO'
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  register: (name: string, email: string, password: string) =>
    apiClient<LoginResponse>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    }),

  cliLogin: (email: string, password: string, sessionId: string) =>
    apiClient<CliLoginResponse>('/auth/cli-login', {
      method: 'POST',
      body: { email, password, sessionId },
    }),

  sessionLogin: async (email: string, password: string) => {
    const response = await apiClient<SessionAuthPayload>('/auth/session/login', {
      method: 'POST',
      body: { email, password },
    })

    if (response.success && response.data?.accessToken) {
      setAccessToken(response.data.accessToken)
    }

    return response
  },

  sessionRegister: async (name: string, email: string, password: string) => {
    const response = await apiClient<SessionAuthPayload>('/auth/session/register', {
      method: 'POST',
      body: { name, email, password },
    })

    if (response.success && response.data?.accessToken) {
      setAccessToken(response.data.accessToken)
    }

    return response
  },

  sessionRefresh: async () => {
    const response = await apiClient<SessionAuthPayload>('/auth/session/refresh', {
      method: 'POST',
    })

    if (response.success && response.data?.accessToken) {
      setAccessToken(response.data.accessToken)
    } else {
      setAccessToken(null)
    }

    return response
  },

  sessionMe: () => apiClientWithAuth<ProfileResponse>('/auth/session/me'),

  sessionLogout: async () => {
    const response = await apiClient<{ loggedOut: boolean }>('/auth/session/logout', {
      method: 'POST',
    })
    setAccessToken(null)
    return response
  },

  sessionLogoutAll: async () => {
    const response = await apiClientWithAuth<{ loggedOutAll: boolean }>(
      '/auth/session/logout-all',
      {
        method: 'POST',
      }
    )
    setAccessToken(null)
    return response
  },

  bootstrapSession: async (): Promise<ApiResponse<ProfileResponse>> => {
    const token = await ensureAccessToken()
    if (!token) {
      return {
        success: false,
        message: 'Missing session',
      }
    }
    return apiClientWithAuth<ProfileResponse>('/auth/session/me')
  },
}

export const dashboardAuth = {
  getToken: getAccessToken,
  setToken: (token: string) => {
    if (!IS_DEV) return
    setAccessToken(token.trim())
  },
  clearToken: () => {
    setAccessToken(null)
  },
}

export type BillingUsageResponse = {
  plan: 'FREE' | 'PRO'
  status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING'
  reviewsCount: number
  reviewsLimit: number
  remainingReviews: number | null
  isUnlimited: boolean
  periodStart: string
  periodEnd: string
}

export type BillingSubscriptionResponse = {
  id: string
  plan: 'FREE' | 'PRO'
  status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING'
  cancelAtPeriodEnd: boolean
  currentPeriodStart: string
  currentPeriodEnd: string
  reviewsLimit: number
  isUnlimited: boolean
}

export type ApiKeyRecord = {
  id: string
  provider: 'GEMINI' | 'OPENAI' | 'CLAUDE'
  keyName: string | null
  isActive: boolean
  isValid: boolean
  lastValidatedAt: string | null
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
  maskedKey: string
}

export type SubmissionsListQuery = {
  page?: number
  limit?: number
  projectId?: string
  status?: 'PENDING' | 'COMPLETED' | 'FAILED'
  provider?: 'GEMINI' | 'OPENAI' | 'CLAUDE'
}

export type SubmissionsListResponse = {
  items: Review[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type ReviewDetailsResponse = {
  id: string
  summary: string | null
  detectedIssues: string | null
  suggestedChanges: string | null
  createdAt: string
  submissionId: string
  submission: {
    id: string
    aiProvider: 'GEMINI' | 'OPENAI' | 'CLAUDE' | null
    usedUserKey: boolean
    createdAt: string
    codeContent: string
    metadata: Record<string, unknown> | null
    project: {
      id: string
      name: string
      repositoryUrl: string | null
    }
    statusSubmission: {
      name: 'PENDING' | 'COMPLETED' | 'FAILED'
    }
  }
}

export type ProjectStatsResponse = Array<{
  id: string
  name: string
  repositoryUrl: string | null
  createdAt: string
  stats: {
    submissionsTotal: number
    completedReviews: number
    totalIssues: number
    securityIssues: number
    performanceIssues: number
    averageScore: number | null
  }
}>

export type AnalyticsRange = '7d' | '30d' | '90d'

export type AnalyticsSummaryResponse = {
  range: AnalyticsRange
  summary: {
    total: number
    completed: number
    failed: number
    inProgress: number
    successRate: number
    failureRate: number
    avgProcessingMs: number
    codeVolume: number
  }
  kpis: KpiData[]
  activity: ActivityDataPoint[]
  issuesByType: IssuesByType[]
  topIssues: TopIssue[]
  repositoryStats: RepoStats[]
}

export type AnalyticsCsvResponse = {
  csv: string
  filename: string
}

export const dashboardApi = {
  getProfile: () => apiClientWithAuth<ProfileResponse>('/users/me'),

  getBillingUsage: () => apiClientWithAuth<BillingUsageResponse>('/billing/usage'),

  getBillingSubscription: () =>
    apiClientWithAuth<BillingSubscriptionResponse>('/billing/subscription'),

  listApiKeys: () => apiClientWithAuth<ApiKeyRecord[]>('/api-keys'),

  createApiKey: (payload: {
    provider: 'GEMINI' | 'OPENAI' | 'CLAUDE'
    key: string
    keyName?: string
  }) =>
    apiClientWithAuth<ApiKeyRecord>('/api-keys', {
      method: 'POST',
      body: payload,
    }),

  deleteApiKey: (provider: 'GEMINI' | 'OPENAI' | 'CLAUDE') =>
    apiClientWithAuth<{ provider: string; keyName: string | null }>(
      `/api-keys/${provider}`,
      { method: 'DELETE' }
    ),

  setActiveProvider: (provider: 'GEMINI' | 'OPENAI' | 'CLAUDE') =>
    apiClientWithAuth<{ provider: string; isActive: boolean }>(
      `/api-keys/${provider}/active`,
      { method: 'PATCH' }
    ),

  revalidateApiKey: (provider: 'GEMINI' | 'OPENAI' | 'CLAUDE') =>
    apiClientWithAuth<ApiKeyRecord>(`/api-keys/${provider}/revalidate`, {
      method: 'POST',
    }),

  listSubmissions: (query: SubmissionsListQuery = {}) =>
    apiClientWithAuth<SubmissionsListResponse>(
      `/submissions${buildQueryString({
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        projectId: query.projectId,
        status: query.status,
        provider: query.provider,
      })}`
    ),

  getReviewById: (reviewId: string) =>
    apiClientWithAuth<ReviewDetailsResponse>(`/reviews/${reviewId}`),

  getProjectsStats: () => apiClientWithAuth<ProjectStatsResponse>('/projects/me/stats'),

  getAnalyticsSummary: (range: AnalyticsRange = '30d') =>
    apiClientWithAuth<AnalyticsSummaryResponse>(
      `/analytics/summary${buildQueryString({ range })}`
    ),

  exportAnalyticsCsv: async (
    range: AnalyticsRange = '30d'
  ): Promise<ApiResponse<AnalyticsCsvResponse>> => {
    const token = await ensureAccessToken()

    if (!token) {
      return {
        success: false,
        message: 'Missing dashboard session',
      }
    }

    try {
      const response = await fetch(
        `${API_URL}/analytics/export.csv${buildQueryString({ range })}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.status === 401) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          return dashboardApi.exportAnalyticsCsv(range)
        }
      }

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const payload = (await response.json()) as ApiResponse<unknown>
          return {
            success: false,
            message: payload.message || 'Failed to export analytics CSV',
            errors: payload.errors,
          }
        }

        return {
          success: false,
          message: 'Failed to export analytics CSV',
        }
      }

      const csv = await response.text()
      const disposition = response.headers.get('content-disposition') || ''
      const filenameMatch = disposition.match(/filename=\"?([^"]+)\"?/i)

      return {
        success: true,
        message: 'Analytics CSV exported successfully',
        data: {
          csv,
          filename: filenameMatch?.[1] || `bugless-analytics-${range}.csv`,
        },
      }
    } catch (error) {
      console.error('Analytics CSV export error:', error)
      return {
        success: false,
        message: 'Network error. Please try again.',
      }
    }
  },
}
