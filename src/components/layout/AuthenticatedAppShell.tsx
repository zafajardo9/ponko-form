import { Link, useRouterState } from '@tanstack/react-router'
import { BadgePercent, BookOpen, CreditCard, FilePlus2, LayoutList, Menu, MessageSquareDot, Rocket, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { useSession } from '../../lib/auth-client'
import { appConfig } from '../../utils/app-config'
import { UserMenu } from '../auth/UserMenu'
import { AppLogo } from '../ui/AppLogo'
import { NavMenu, type NavMenuItem } from './NavMenu'

const FloatingQuickActions = lazy(() =>
  import('./FloatingQuickActions').then((module) => ({
    default: module.FloatingQuickActions,
  })),
)

export default function AuthenticatedAppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const focusedEditor = /^\/forms\/[^/]+\/edit\/?$/.test(pathname)
    || /^\/popups\/[^/]+\/edit\/?$/.test(pathname)
  const authPage = pathname === '/sign-in' || pathname.startsWith('/sign-in/')
  const progressPage = pathname === '/progress'
  const { data: session } = useSession()
  const signedIn = Boolean(session)
  const workspacePage = pathname === '/dashboard'
    || pathname.startsWith('/dashboard/')
    || pathname === '/forms'
    || pathname.startsWith('/forms/')
    || pathname === '/discounts'
    || pathname.startsWith('/settings/')
  const showQuickActions = signedIn
    && workspacePage
    && !focusedEditor
    && pathname !== '/forms/new'

  return (
    <>
      {!focusedEditor && !authPage && !progressPage && <TopNav signedIn={signedIn} />}
      {children}
      {showQuickActions ? (
        <Suspense fallback={null}>
          <FloatingQuickActions />
        </Suspense>
      ) : null}
    </>
  )
}

const navLinkClass =
  'text-sm text-[#6c6a64] transition-colors hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 [&.active]:font-medium [&.active]:text-[#141413]'

// Workspace destinations are grouped behind one hover menu so the top bar
// stays short; each entry gets an icon tile and a one-line description.
const workspaceItems: NavMenuItem[] = [
  {
    to: '/forms',
    label: 'Forms',
    description: 'Open, edit, and share every form',
    icon: LayoutList,
    tileClass: 'bg-[#f5e4dc] text-[#a9583e]',
    activeWhen: (pathname) => pathname === '/forms' || (pathname.startsWith('/forms/') && pathname !== '/forms/new'),
  },
  {
    to: '/forms/new',
    label: 'New form',
    description: 'Start a form from a blank canvas',
    icon: FilePlus2,
    tileClass: 'bg-[#eaf4ec] text-[#3f7048]',
    activeWhen: (pathname) => pathname === '/forms/new',
  },
  {
    to: '/popups',
    label: 'Popups',
    description: 'Lead-capture popups for any site',
    icon: MessageSquareDot,
    tileClass: 'bg-[#e8eefc] text-[#2f5fc4]',
    activeWhen: (pathname) => pathname === '/popups' || /^\/popups\/[^/]+\/edit\/?$/.test(pathname),
  },
  {
    to: '/dashboard/payment-links',
    label: 'Payment Links',
    description: 'Charge directly, no form needed',
    icon: CreditCard,
    tileClass: 'bg-[#e8eefc] text-[#2f5fc4]',
    activeWhen: (pathname) => pathname === '/dashboard/payment-links',
  },
  {
    to: '/discounts',
    label: 'Discounts',
    description: 'Codes, percent-off, and deals',
    icon: BadgePercent,
    tileClass: 'bg-[#fff3d6] text-[#96731d]',
  },
]

const resourcesItems: NavMenuItem[] = [
  {
    to: '/docs',
    label: 'Documentation',
    description: 'Guides, concepts, and how-tos',
    icon: BookOpen,
    tileClass: 'bg-[#f1ecfd] text-[#6d4fc9]',
  },
  {
    to: '/progress',
    label: 'Progress',
    description: 'Roadmap and what shipped lately',
    icon: Rocket,
    tileClass: 'bg-[#fde8e4] text-[#b3543c]',
  },
]

export function TopNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center border-b border-[#e6dfd8] bg-[#faf9f5]/95 px-4 backdrop-blur-sm sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
          >
            <AppLogo className="h-7 w-7 rounded-lg" fallbackClassName="bg-[#cc785c] text-sm font-bold text-white" />
            <span className="text-base font-semibold tracking-tight text-[#141413]">
              {appConfig.name}
            </span>
          </Link>

          <nav className="hidden items-center gap-5 sm:flex" aria-label="Primary">
            {signedIn ? <>
              <Link
                to="/dashboard"
                className={navLinkClass}
              >
                Dashboard
              </Link>
              <NavMenu label="Workspace" items={workspaceItems} />
              <Link to="/settings/integrations" className={navLinkClass}>
                Integrations
              </Link>
            </> : null}
            <NavMenu label="Resources" items={resourcesItems} />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <MobileNavigation signedIn={signedIn} />
          {!signedIn ? <>
            <a
              href="/sign-in"
              className="hidden rounded-md text-sm font-medium text-[#6c6a64] transition-colors hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 sm:inline"
            >
              Sign in
            </a>
            <a
              href="/sign-in"
              className="inline-flex h-9 shrink-0 items-center rounded-md bg-[#cc785c] px-3 text-sm font-medium text-white transition-colors hover:bg-[#a9583e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 sm:px-4"
            >
              <span className="sm:hidden">Start free</span>
              <span className="hidden sm:inline">Get started free</span>
            </a>
          </> : null}
          {signedIn ? <UserMenu /> : null}
        </div>
      </div>
    </header>
  )
}

function MobileNavigation({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={containerRef} className="relative sm:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#e6dfd8] bg-[#faf9f5] text-[#3d3d3a] transition-colors hover:bg-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
      >
        {open
          ? <X size={18} aria-hidden="true" />
          : <Menu size={18} aria-hidden="true" />}
      </button>

      {open && (
        <nav
          id={menuId}
          aria-label="Mobile navigation"
          className="absolute right-0 top-12 w-60 overflow-hidden rounded-xl border border-[#e6dfd8] bg-[#faf9f5] p-2 shadow-[0_18px_45px_rgba(37,35,32,0.14)]"
        >
          {signedIn ? <>
            <p className="px-3 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[#8e8b82]">
              Workspace
            </p>
            <MobileNavLink to="/dashboard" onSelect={close}>Dashboard</MobileNavLink>
            <MobileNavLink to="/forms" onSelect={close}>Forms</MobileNavLink>
            <MobileNavLink to="/forms/new" onSelect={close}>New form</MobileNavLink>
            <MobileNavLink to="/popups" onSelect={close}>Popups</MobileNavLink>
            <MobileNavLink to="/dashboard/payment-links" onSelect={close}>Payment Links</MobileNavLink>
            <MobileNavLink to="/discounts" onSelect={close}>Discounts</MobileNavLink>
            <MobileNavLink to="/settings/integrations" onSelect={close}>Integrations</MobileNavLink>
            <div className="my-2 h-px bg-[#e6dfd8]" />
          </> : null}
          <p className="px-3 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[#8e8b82]">
            Resources
          </p>
          <MobileNavLink to="/docs" onSelect={close}>Documentation</MobileNavLink>
          <MobileNavLink to="/progress" onSelect={close}>Progress</MobileNavLink>
          {!signedIn ? (
            <a
              href="/sign-in"
              onClick={close}
              className="flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-[#3d3d3a] transition-colors hover:bg-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cc785c]"
            >
              Sign in
            </a>
          ) : null}
        </nav>
      )}
    </div>
  )
}

function MobileNavLink({
  to,
  onSelect,
  children,
}: {
  to: '/dashboard' | '/dashboard/payment-links' | '/popups' | '/discounts' | '/forms' | '/forms/new' | '/settings/integrations' | '/docs' | '/progress'
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      onClick={onSelect}
      className="flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-[#3d3d3a] transition-colors hover:bg-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cc785c] [&.active]:bg-[#efe9de] [&.active]:text-[#141413]"
    >
      {children}
    </Link>
  )
}
