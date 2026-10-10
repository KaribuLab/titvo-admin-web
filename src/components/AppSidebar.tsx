import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GitBranch, KeyRound, LayoutDashboard, Settings2, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from './ui/sidebar'
import { NavUser } from './NavUser'
import titvoLogo from '../assets/titvo-logo.png'

interface NavItem {
  to: string
  labelKey: 'sidebar.dashboard' | 'sidebar.config' | 'sidebar.repos' | 'sidebar.apiKeys' | 'sidebar.users'
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

const PLATFORM_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'sidebar.dashboard', icon: LayoutDashboard, end: true },
  { to: '/repos', labelKey: 'sidebar.repos', icon: GitBranch }
]

const ADMIN_ITEMS: NavItem[] = [
  { to: '/api-keys', labelKey: 'sidebar.apiKeys', icon: KeyRound },
  { to: '/users', labelKey: 'sidebar.users', icon: Users },
  { to: '/config', labelKey: 'sidebar.config', icon: Settings2 }
]

/** Same active-route rule the old `AppHeader` nav pill used: exact match for Dashboard, prefix match otherwise. */
function isNavItemActive (pathname: string, item: NavItem): boolean {
  return item.end === true ? pathname === item.to : pathname.startsWith(item.to)
}

function NavGroup ({ items, label }: { items: NavItem[], label: string }): React.ReactElement {
  const location = useLocation()
  const { t } = useTranslation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(item => {
          const Icon = item.icon
          const active = isNavItemActive(location.pathname, item)
          const itemLabel = t(item.labelKey)
          return (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton asChild isActive={active} tooltip={itemLabel}>
                <NavLink to={item.to} end={item.end}>
                  <Icon aria-hidden='true' />
                  <span>{itemLabel}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

/**
 * shadcn/ui dashboard-01 style collapsible Sidebar.
 * - Navigation grouped into Platform and Administration sections.
 * - Brand home button in the header.
 * - User menu extracted into a reusable NavUser component in the footer.
 */
export function AppSidebar (): React.ReactElement {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const roleLabel = (role: 'admin' | 'member'): string => (role === 'admin' ? t('users.admin') : t('users.member'))

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={t('appShell.title')}
              className='data-[slot=sidebar-menu-button]:p-1.5!'
            >
              <NavLink to='/' aria-label={t('appShell.title')}>
                <img src={titvoLogo} alt='' className='h-5 w-auto object-contain' />
                <span className='text-base font-semibold group-data-[collapsible=icon]:hidden'>Titvo</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup label={t('sidebar.platform')} items={PLATFORM_ITEMS} />
        {import.meta.env.VITE_TITVO_LAB !== 'true' && (
          <>
            <SidebarSeparator />
            <NavGroup label={t('sidebar.administration')} items={ADMIN_ITEMS} />
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        {user !== null && (
          <NavUser
            user={{ email: user.email, role: user.role }}
            roleLabel={roleLabel(user.role)}
            onLogout={() => { void logout() }}
          />
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
