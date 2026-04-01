import type { NavItem } from './dashboard-types'

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', href: '/dashboard', icon: 'house' },
  { id: 'reviews', label: 'Reviews', href: '/dashboard/reviews', icon: 'code' },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/dashboard/analytics',
    icon: 'chart-line',
  },
  {
    id: 'repositories',
    label: 'Repositories',
    href: '/dashboard/repositories',
    icon: 'folder',
    disabled: true,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    href: '/dashboard/notifications',
    icon: 'bell',
    badge: 3,
    disabled: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/dashboard/settings/api-keys',
    icon: 'gear',
  },
]
