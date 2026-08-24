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

export function AppShell() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [shellTheme, setShellTheme] = useState('light');
  const [searchQuery, setSearchQuery] = useState('');
  const dashboardPath = user?.role === 'AGENT' ? '/agent/dashboard' : '/admin/dashboard';
  const navItems = [
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
        <div className="flex h-full items-center justify-between px-6">
          <Link to={dashboardPath} className="flex items-center">
            <Logo />
          </Link>

          <div className="mx-8 hidden max-w-md flex-1 lg:block">
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

          <div className="flex items-center gap-2">
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
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-elevated">
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

      <aside className="fixed bottom-0 left-0 top-16 w-64 border-r border-border bg-surface px-3 py-4">
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = iconMap[item.label as keyof typeof iconMap];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-ink-muted hover:bg-hover hover:text-ink'
                  }`
                }
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className="min-h-screen pl-64 pt-16">
        <div className="px-6 py-8 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
