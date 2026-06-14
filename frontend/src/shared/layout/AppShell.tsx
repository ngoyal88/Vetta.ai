import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Folder,
  LayoutGrid,
  Menu,
  Search,
  Sparkles,
  User,
  Rocket,
  X,
} from 'lucide-react';

import { useAuth } from 'shared/context/AuthContext';
import UserAccountMenu from 'shared/components/UserAccountMenu';

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  end?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid, end: true },
  { label: 'AI Interview', href: '/ai-interview', icon: Rocket },
  { label: 'Resume Vault', href: '/resume-vault', icon: Folder },
  { label: 'Signal', href: '/signal-intelligence', icon: Sparkles },
];

type AppShellProps = {
  children: React.ReactNode;
};

const AppShell = ({ children }: AppShellProps) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isAiInterview = location.pathname.startsWith('/ai-interview');
  const searchPlaceholder = isAiInterview
    ? 'Search modes, past sessions...'
    : 'Search commands, skills, jobs...';

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const sidebarClasses = [
    'dashboard-sidebar fixed bottom-0 left-0 z-50 hidden flex-col px-4 py-6 lg:flex',
    collapsed ? 'dashboard-sidebar--collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="dashboard-shell dot-grid min-h-screen"
      data-sidebar={collapsed ? 'collapsed' : 'expanded'}
    >
      <aside className={sidebarClasses}>
        <nav className="dashboard-nav flex-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon, end }) => (
            <NavLink
              key={href}
              to={href}
              end={end}
              aria-label={label}
              className={({ isActive }) =>
                [
                  'dashboard-nav-link',
                  isActive ? 'dashboard-nav-link--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              <Icon className="h-4 w-4" />
              <span className="dashboard-sidebar__label type-label-md">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-4 border-t border-[var(--border-subtle)] pt-5">
          <Link
            to="/pricing"
            className="btn-primary dashboard-cta dashboard-sidebar__cta w-full justify-center shadow-luminous"
          >
            <Sparkles className="h-4 w-4" />
            <span className="dashboard-sidebar__label">Upgrade to Pro</span>
          </Link>
          <div className="space-y-1">
            <Link to="/profile" className="dashboard-nav-link" aria-label="Settings">
              <User className="h-4 w-4" />
              <span className="dashboard-sidebar__label type-label-md">Settings</span>
            </Link>
            <Link to="/contact" className="dashboard-nav-link" aria-label="Help">
              <BookOpen className="h-4 w-4" />
              <span className="dashboard-sidebar__label type-label-md">Help</span>
            </Link>
          </div>

        </div>
      </aside>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="dashboard-mobile-overlay"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="dashboard-sidebar dashboard-sidebar--mobile">
            <div className="mb-6 flex items-center justify-end px-4">
              <button
                type="button"
                className="dashboard-icon-btn inline-flex"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="dashboard-nav dashboard-nav--mobile flex-1">
              {NAV_ITEMS.map(({ label, href, icon: Icon, end }) => (
                <NavLink
                  key={href}
                  to={href}
                  end={end}
                  className={({ isActive }) =>
                    [
                      'dashboard-nav-link',
                      isActive ? 'dashboard-nav-link--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="type-label-md">{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto space-y-3 border-t border-[var(--border-subtle)] px-4 pt-4">
              <Link to="/pricing" className="btn-primary dashboard-cta w-full justify-center shadow-luminous">
                Upgrade to Pro
              </Link>
              <Link to="/profile" className="dashboard-nav-link" aria-label="Settings">
                <User className="h-4 w-4" />
                <span className="type-label-sm">Settings</span>
              </Link>
              <Link to="/contact" className="dashboard-nav-link">
                <BookOpen className="h-4 w-4" />
                <span className="type-label-sm">Help</span>
              </Link>
            </div>
          </aside>
        </>
      ) : null}

      <header className="dashboard-topbar">
        <div className="dashboard-topbar__inner">
          <div className="dashboard-topbar__left">
            <button
              type="button"
              className="dashboard-icon-btn inline-flex lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="dashboard-icon-btn hidden lg:inline-flex"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/dashboard" className="dashboard-topbar__brand" aria-label="Vetta.ai">
              Vetta.ai
            </Link>
          </div>

          <div className="dashboard-topbar__actions">
            <div className="dashboard-topbar__search relative hidden md:flex">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
              <input
                type="search"
                placeholder={searchPlaceholder}
                className="dashboard-search w-full py-2.5 pl-10 pr-4 text-sm"
                aria-label="Search"
              />
            </div>
            <button
              type="button"
              className="dashboard-icon-btn inline-flex"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            {currentUser ? (
              <UserAccountMenu user={currentUser} onLogout={logout} />
            ) : (
              <Link to="/signin" className="btn-ghost">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="app-shell-content">{children}</div>
      </div>
    </div>
  );
};

export default AppShell;
