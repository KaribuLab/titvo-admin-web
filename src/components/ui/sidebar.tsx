import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { PanelLeft } from 'lucide-react'

import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * shadcn/ui's documented collapsible Sidebar pattern (hand-built to match
 * what `npx shadcn@latest add sidebar-01` normally produces — the CLI's
 * interactive preset picker doesn't work non-interactively in this
 * environment, see PHASE A migration notes). Desktop: a fixed panel that
 * collapses to icon-only or fully off-canvas. Mobile (`useIsMobile`):
 * becomes a `Sheet` overlay instead of a separate hand-built mobile nav.
 * Expanded/collapsed state persists across reloads via a cookie, exactly
 * like shadcn's own reference implementation (so a server could read it
 * too, even though this app has no SSR today).
 */

const SIDEBAR_COOKIE_NAME = 'sidebar:state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_MOBILE = '18rem'
const SIDEBAR_WIDTH_ICON = '3.5rem'
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

interface SidebarContextValue {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function useSidebar (): SidebarContextValue {
  const context = React.useContext(SidebarContext)
  if (context === null) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

interface SidebarProviderProps extends React.ComponentProps<'div'> {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const SidebarProvider = React.forwardRef<HTMLDivElement, SidebarProviderProps>(
  ({ defaultOpen = true, open: openProp, onOpenChange: setOpenProp, className, style, children, ...props }, ref) => {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)

    const [internalOpen, setInternalOpen] = React.useState(() => {
      if (typeof document === 'undefined') return defaultOpen
      const match = document.cookie.match(new RegExp(`(?:^|; )${SIDEBAR_COOKIE_NAME}=([^;]*)`))
      if (match === null) return defaultOpen
      return match[1] === 'true'
    })
    const open = openProp ?? internalOpen

    const setOpen = React.useCallback(
      (value: boolean) => {
        if (setOpenProp !== undefined) {
          setOpenProp(value)
        } else {
          setInternalOpen(value)
        }
        if (typeof document !== 'undefined') {
          document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
        }
      },
      [setOpenProp]
    )

    const toggleSidebar = React.useCallback(() => {
      return isMobile ? setOpenMobile(previous => !previous) : setOpen(!open)
    }, [isMobile, open, setOpen])

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          toggleSidebar()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [toggleSidebar])

    const state = open ? 'expanded' : 'collapsed'

    const contextValue = React.useMemo<SidebarContextValue>(
      () => ({ state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }),
      [state, open, setOpen, isMobile, openMobile, toggleSidebar]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={{
              '--sidebar-width': SIDEBAR_WIDTH,
              '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
              ...style
            } as React.CSSProperties}
            className={cn('group/sidebar-wrapper flex min-h-svh w-full', className)}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = 'SidebarProvider'

interface SidebarProps extends React.ComponentProps<'div'> {
  side?: 'left' | 'right'
  collapsible?: 'offcanvas' | 'icon' | 'none'
}

export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ side = 'left', collapsible = 'icon', className, children, ...props }, ref) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

    if (collapsible === 'none') {
      return (
        <div className={cn('flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground', className)} ref={ref} {...props}>
          {children}
        </div>
      )
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
            style={{ '--sidebar-width': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
            side={side}
          >
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      )
    }

    return (
      <div
        ref={ref}
        className="group peer hidden md:block text-sidebar-foreground"
        data-state={state}
        data-collapsible={state === 'collapsed' ? collapsible : ''}
        data-side={side}
      >
        {/* Spacer that reserves layout width and animates with the real sidebar. */}
        <div
          className={cn(
            'relative h-svh w-[--sidebar-width] bg-transparent transition-[width] duration-200 ease-linear',
            'group-data-[collapsible=offcanvas]:w-0',
            'group-data-[collapsible=icon]:w-[--sidebar-width-icon]'
          )}
        />
        <div
          className={cn(
            'fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] duration-200 ease-linear md:flex',
            side === 'left'
              ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
              : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
            'group-data-[collapsible=icon]:w-[--sidebar-width-icon]',
            side === 'left' ? 'border-r' : 'border-l',
            className
          )}
          {...props}
        >
          <div data-sidebar="sidebar" className="flex h-full w-full flex-col bg-sidebar">
            {children}
          </div>
        </div>
      </div>
    )
  }
)
Sidebar.displayName = 'Sidebar'

export const SidebarTrigger = React.forwardRef<
React.ElementRef<typeof Button>,
React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      aria-label="Toggle sidebar"
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = 'SidebarTrigger'

export const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentProps<'main'>>(
  ({ className, ...props }, ref) => (
    <main
      ref={ref}
      className={cn(
        'relative flex min-h-svh flex-1 flex-col bg-background',
        className
      )}
      {...props}
    />
  )
)
SidebarInset.displayName = 'SidebarInset'

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-sidebar="header" className={cn('flex flex-col gap-2 p-3', className)} {...props} />
  )
)
SidebarHeader.displayName = 'SidebarHeader'

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-sidebar="footer" className={cn('flex flex-col gap-2 p-3', className)} {...props} />
  )
)
SidebarFooter.displayName = 'SidebarFooter'

export const SidebarSeparator = React.forwardRef<
React.ElementRef<typeof Separator>,
React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => (
  <Separator ref={ref} className={cn('mx-3 w-auto bg-sidebar-border', className)} {...props} />
))
SidebarSeparator.displayName = 'SidebarSeparator'

export const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden', className)}
      {...props}
    />
  )
)
SidebarContent.displayName = 'SidebarContent'

export const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-sidebar="group" className={cn('relative flex w-full min-w-0 flex-col p-2', className)} {...props} />
  )
)
SidebarGroup.displayName = 'SidebarGroup'

export const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 transition-[margin,opacity] duration-200 ease-linear',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className
      )}
      {...props}
    />
  )
)
SidebarGroupLabel.displayName = 'SidebarGroupLabel'

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<'ul'>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} data-sidebar="menu" className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />
  )
)
SidebarMenu.displayName = 'SidebarMenu'

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} data-sidebar="menu-item" className={cn('group/menu-item relative', className)} {...props} />
  )
)
SidebarMenuItem.displayName = 'SidebarMenuItem'

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2',
  {
    variants: {
      isActive: {
        true: 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
        false: ''
      }
    },
    defaultVariants: {
      isActive: false
    }
  }
)

export interface SidebarMenuButtonProps
  extends React.ComponentProps<'button'>,
  VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean
  tooltip?: string
}

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ asChild = false, isActive = false, tooltip, className, ...props }, ref) => {
    const { state, isMobile } = useSidebar()
    const Comp = asChild ? Slot : 'button'

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ isActive }), className)}
        {...props}
      />
    )

    if (tooltip === undefined || tooltip === '') return button
    if (state !== 'collapsed' || isMobile) return button

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" align="center">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = 'SidebarMenuButton'
