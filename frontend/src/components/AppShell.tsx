import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  UserPlus,
  UserCheck,
  Router,
  Activity,
  BarChart3,
  FileText,
  Settings,
  Lock,
  Bell,
  Search,
  LogOut,
  Globe,
  Menu,
  X,
  GripVertical,
} from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { listNotifications, markAllNotificationsRead } from '../notifications/api';
import { getSettings } from '../settings/api';
import type { NotificationItem } from '../notifications/types';
import { Logo } from './Logo';

const iconMap = {
  Dashboard: LayoutDashboard,
  Customers: Users,
  Campaigns: Megaphone,
  Agents: UserPlus,
  Assignments: UserCheck,
  Modems: Router,
  Supervisor: Activity,
  Reports: BarChart3,
  'Audit Logs': FileText,
  Settings: Settings,
  'Change Password': Lock,
  'Situation Room': Globe,
  'Polling Units': Globe,
  'Election Assignments': UserCheck,
  'Election Targets': BarChart3,
  'Parties / Candidates': Users,
};

const NAV_ORDER_KEY = 'sidebar-nav-order';

type NavItem = { label: string; to: string };

function readPersistedOrder(defaults: NavItem[]): NavItem[] {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.sessionStorage.getItem(NAV_ORDER_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as NavItem[];
    if (!Array.isArray(parsed)) return defaults;
    const byTo = new Map(defaults.map((item) => [item.to, item]));
    const knownTo = new Set(defaults.map((item) => item.to));
    const ordered: NavItem[] = [];
    parsed.forEach((item) => {
      if (item && typeof item.to === 'string' && knownTo.has(item.to)) {
        const match = byTo.get(item.to);
        if (match) ordered.push(match);
      }
    });
    defaults.forEach((item) => {
      if (!ordered.find((existing) => existing.to === item.to)) {
        ordered.push(item);
      }
    });
    return ordered;
  } catch {
    return defaults;
  }
}

export function AppShell() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [shellTheme, setShellTheme] = useState('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dashboardPath = user?.role === 'AGENT' ? '/agent/dashboard' : '/admin/dashboard';
  const defaultNavItems: NavItem[] = [
    { label: 'Dashboard', to: dashboardPath },
    ...(user?.role === 'ADMIN'
      ? [
          { label: 'Customers', to: '/admin/customers' },
          { label: 'Campaigns', to: '/admin/campaigns' },
          { label: 'Agents', to: '/admin/agents' },
          { label: 'Assignments', to: '/admin/assignments' },
          { label: 'Modems', to: '/admin/modems' },
          { label: 'Supervisor', to: '/admin/supervisor' },
          { label: 'Reports', to: '/admin/reports' },
          { label: 'Audit Logs', to: '/admin/audit-logs' },
          { label: 'Settings', to: '/admin/settings' },
        ]
      : []),
    ...(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR'
      ? [
          { label: 'Situation Room', to: '/admin/election' },
          { label: 'Polling Units', to: '/admin/election/polling-units/import' },
          { label: 'Election Assignments', to: '/admin/election/assignments' },
          { label: 'Election Targets', to: '/admin/election/targets' },
          { label: 'Parties / Candidates', to: '/admin/election/parties' },
        ]
      : []),
    { label: 'Change Password', to: '/change-password' },
  ];
  const [navItems, setNavItems] = useState<NavItem[]>(() => readPersistedOrder(defaultNavItems));

  useEffect(() => {
    setNavItems((current) => {
      const defaults = defaultNavItems;
      const known = new Set(defaults.map((item) => item.to));
      const currentKnown = current.filter((item) => known.has(item.to));
      const defaultsToAdd = defaults.filter((item) => !currentKnown.find((existing) => existing.to === item.to));
      const isSameAsDefault = current.length === defaults.length && defaults.every((d, i) => current[i]?.to === d.to);
      if (isSameAsDefault) return defaults;
      if (defaultsToAdd.length === 0 && current.length === currentKnown.length) return current;
      return [...currentKnown, ...defaultsToAdd];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(NAV_ORDER_KEY, JSON.stringify(navItems));
    } catch {
      // ignore
    }
  }, [navItems]);

  function handleDragStart(event: React.DragEvent<HTMLDivElement>, index: number) {
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    try {
      event.dataTransfer.setData('text/plain', String(index));
    } catch {
      // some browsers throw if called outside dragstart in dev
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  }

  function handleDragLeave() {
    // no-op; dragOverIndex is set on dragOver to track the current target
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>, dropIndex: number) {
    event.preventDefault();
    const fromIndex = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (fromIndex === null || fromIndex === dropIndex) return;
    setNavItems((current) => {
      const next = current.slice();
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return current;
      next.splice(dropIndex, 0, moved);
      return next;
    });
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  useEffect(() => {
    if (!token) return;

    const loadNotifications = () => {
      listNotifications(token)
        .then((result) => {
          setNotifications(result.data);
          setUnreadCount(result.unreadCount);
        })
        .catch(() => undefined);
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(intervalId);
  }, [token]);

  async function handleMarkAllRead() {
    if (!token) return;
    await markAllNotificationsRead(token);
    setUnreadCount(0);
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }

  useEffect(() => {
    getSettings()
      .then((settings) => setShellTheme(settings.theme))
      .catch(() => undefined);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const shellClass =
    shellTheme === 'dark'
      ? 'min-h-screen bg-slate-950 text-slate-100'
      : shellTheme === 'gold'
        ? 'min-h-screen bg-amber-50 text-ink'
        : 'min-h-screen bg-background text-ink';

  return (
    <div className={shellClass}>
      <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-border bg-surface/80 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((current) => !current)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-hover hover:text-ink lg:hidden"
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to={dashboardPath} className="flex items-center">
              <Logo />
            </Link>
          </div>

          <div className="mx-4 hidden max-w-md flex-1 lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="input h-9 pl-9 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications((current) => !current)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-hover hover:text-ink"
              >
                <Bell className="h-5 w-5" />
                {unreadCount ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-elevated">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-sm font-semibold text-ink">Notifications</span>
                    <button
                      type="button"
                      onClick={() => void handleMarkAllRead()}
                      className="text-xs font-medium text-primary hover:text-primary-hover"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {notifications.map((item) => (
                      <div
                        key={item.id}
                        className={`border-b border-border px-4 py-3 text-sm last:border-b-0 ${item.read ? 'text-ink-muted' : 'text-ink'}`}
                      >
                        <div>{item.message}</div>
                        <div className="mt-1 text-xs text-ink-muted">{new Date(item.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                    {!notifications.length ? (
                      <div className="px-4 py-8 text-center text-sm text-ink-muted">No notifications.</div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden items-center gap-3 pl-2 md:flex">
              <div className="text-right">
                <div className="text-sm font-medium text-ink">{user?.fullName}</div>
                <div className="text-xs text-ink-muted">{user?.role}</div>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary">
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                  {user?.fullName?.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-hover hover:text-ink"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-16 z-40 w-64 border-r border-border bg-surface px-3 py-4 transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-2 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          <span>Navigation</span>
          <span className="hidden sm:inline">Drag to reorder</span>
        </div>
        <nav className="space-y-0.5">
          {navItems.map((item, index) => {
            const Icon = iconMap[item.label as keyof typeof iconMap];
            const isDragging = draggedIndex === index;
            const isDropTarget = dragOverIndex === index && draggedIndex !== null && draggedIndex !== index;
            return (
              <div
                key={item.to}
                draggable
                onDragStart={(event) => handleDragStart(event, index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDragLeave={handleDragLeave}
                onDrop={(event) => handleDrop(event, index)}
                onDragEnd={handleDragEnd}
                className={`group relative flex items-center rounded-lg transition ${
                  isDragging ? 'opacity-50' : ''
                } ${isDropTarget ? 'ring-2 ring-primary' : ''}`}
              >
                <span
                  className="flex h-10 w-5 cursor-grab items-center justify-center text-ink-muted opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
                  aria-hidden="true"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
                <NavLink
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex h-10 flex-1 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-ink-muted hover:bg-hover hover:text-ink'
                    }`
                  }
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="min-h-screen pl-0 pt-16 lg:pl-64">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
