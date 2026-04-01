export interface DashboardUser {
  id: string
  name: string
  email: string
  plan: string
}

export interface KpiData {
  id: string
  title: string
  value: string | number
  trend: number
  trendDirection: 'up' | 'down'
  icon: 'code' | 'bug' | 'clock' | 'shield'
  trendIsPositive: boolean
}

export interface ActivityDataPoint {
  date: string
  reviews: number
  bugs: number
}

export interface NavItem {
  id: string
  label: string
  href: string
  icon: 'house' | 'code' | 'chart-line' | 'folder' | 'gear' | 'bell'
  badge?: number
  disabled?: boolean
}

export type ReviewStatus = 'completed' | 'in_progress' | 'failed'
export type ReviewMode = 'pr' | 'commit' | 'uncommitted' | 'custom'
export type ReviewPreset = 'standard' | 'security' | 'performance' | 'quick' | 'thorough'
export type ReviewProvider = 'GEMINI' | 'OPENAI' | 'CLAUDE' | null

export interface Review {
  id: string
  reviewId: string | null
  title: string
  repository: string
  branch: string
  status: ReviewStatus
  mode: ReviewMode
  preset: ReviewPreset
  issuesFound: number
  securityIssues: number
  performanceIssues: number
  reviewTime: string
  createdAt: string
  provider: ReviewProvider
  projectId: string
}

export interface RepoStats {
  repo: string
  reviews: number
  bugs: number
  security: number
  performance: number
}

export interface IssuesByType {
  type: string
  count: number
  color: string
}

export type IssueCategory = 'bug' | 'security' | 'performance' | 'style'

export interface TopIssue {
  id: string
  type: string
  count: number
  category: IssueCategory
}
