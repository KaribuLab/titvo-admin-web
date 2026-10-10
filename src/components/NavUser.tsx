import React from 'react'
import { useTranslation } from 'react-i18next'
import { EllipsisVertical, LogOut } from 'lucide-react'
import { initialsFromEmail } from '../lib/initials'
import { Avatar, AvatarFallback } from './ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from './ui/sidebar'

export interface NavUserUser {
  email: string
  role: 'admin' | 'member'
}

interface NavUserProps {
  user: NavUserUser
  roleLabel: string
  onLogout: () => void
}

/**
 * User menu that lives in the sidebar footer, matching the shadcn/ui
 * dashboard-01 block pattern. Trigger is a large sidebar menu button showing
 * the avatar, email and role; the dropdown exposes logout.
 */
export function NavUser ({ user, roleLabel, onLogout }: NavUserProps): React.ReactElement {
  const { isMobile } = useSidebar()
  const { t } = useTranslation()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              asChild
              tooltip={user.email}
              className='h-auto min-h-[2.75rem] items-center gap-3 px-2 py-2 aria-expanded:bg-sidebar-accent'
            >
              <button>
                <Avatar className='h-8 w-8 rounded-lg'>
                  <AvatarFallback aria-label={`${t('dashboard.signedInAs', { email: user.email })}`} className='rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs'>
                    {initialsFromEmail(user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden'>
                  <span className='truncate font-medium'>{user.email}</span>
                  <span className='truncate text-xs text-sidebar-foreground/70'>{roleLabel}</span>
                </div>
                <EllipsisVertical className='ml-auto h-4 w-4 shrink-0 group-data-[collapsible=icon]:hidden' aria-hidden='true' />
              </button>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='min-w-56'
            side={isMobile ? 'bottom' : 'right'}
            align='end'
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className='p-0 font-normal'>
                <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
                  <Avatar className='h-8 w-8 rounded-lg'>
                    <AvatarFallback aria-label={`${t('dashboard.signedInAs', { email: user.email })}`} className='rounded-lg bg-muted text-xs'>
                      {initialsFromEmail(user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className='grid flex-1 text-left text-sm leading-tight'>
                    <span className='truncate font-medium'>{user.email}</span>
                    <span className='truncate text-xs text-muted-foreground'>{roleLabel}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={import.meta.env.VITE_TITVO_LAB === 'true'} onSelect={() => { void onLogout() }}>
              <LogOut className='mr-2 h-4 w-4' aria-hidden='true' />
              {t('sidebar.logOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
