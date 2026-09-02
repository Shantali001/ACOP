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
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

const NAV_ORDER_KEY = 'acop_sidebar_order';

type NavItem = { label: string; to: string };

const DEFAULT_ORDER: NavItem[] = [
  { label: 'Dashboard', to: '/admin/dashboard' },
  { label: 'Customers', to: '/admin/customers' },
  { label: 'Campaigns', to: '/admin/campaigns' },
  { label: 'Agents', to: '/admin/agents' },
  { label: 'Assignments', to: '/admin/assignments' },
  { label: 'Modems', to: '/admin/modems' },
  { label: 'Supervisor', to: '/admin/supervisor' },
  { label: 'Reports', to: '/admin/reports' },
  { label: 'Audit Logs', to: '/admin/audit-logs' },
  { label: 'Settings', to: '/admin/settings' },
  { label: 'Situation Room', to: '/admin/election' },
  { label: 'Polling Units', to: '/admin/election/polling-units/import' },
  { label: 'Election Assignments', to: '/admin/election/assignments' },
  { label: 'Election Targets', to: '/admin/election/targets' },
  { label: 'Parties / Candidates', to: '/admin/election/parties' },
  { label: 'Change Password', to: '/change-password' },
];

function readPersistedOrder(): NavItem[] {
  if (typeof window === 'undefined') return DEFAULT_ORDER;
  try {
    const raw = window.localStorage.getItem(NAV_ORDER_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw) as NavItem[];
    if (!Array.isArray(parsed)) return DEFAULT_ORDER;
    const known = new Set(DEFAULT_ORDER.map((item) => item.to));
    const ordered: NavItem[] = [];
    parsed.forEach((item) => {
      if (item && typeof item.to === 'string' && known.has(item.to)) {
        const match = DEFAULT_ORDER.find((d) => d.to === item.to);
        if (match) ordered.push(match);
      }
    });
    DEFAULT_ORDER.forEach((item) => {
      if (!ordered.find((existing) => existing.to === item.to)) {
        ordered.push(item);
      }
    });
    return ordered;
  } catch {
    return DEFAULT_ORDER;
  }
}

function SortableNavItem({ item, isReorderMode, isActive }: { item: NavItem; isReorderMode: boolean; isActive: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.to });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
    boxShadow: isDragging ? '0 10px 25px -5px rgb(0 0 0 / 0.15)' : undefined,
  };

  const Icon = iconMap[item.label as keyof typeof iconMap];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center rounded-lg transition ${isDragging ? 'is-dragging' : ''}`}
    >
      {isReorderMode ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="flex h-10 w-5 shrink-0 cursor-grab items-center justify-center text-ink-muted active:cursor-grabbing"
          aria-label={`Drag to reorder ${item.label}`}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <NavLink
        to={item.to}
        onClick={() => {}}
        className={({ isActive: active }) =>
          `flex h-10 flex-1 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${
            active || isActive
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
  const [isReorderMode, setIsReorderMode] = useState(false);
  const dashboardPath = user?.role === 'AGENT' ? '/agent/dashboard' : '/admin/dashboard';
  const [navItems, setNavItems] = useState<NavItem[]>(readPersistedOrder);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  useEffect(() => {
    setNavItems((current) => {
      const defaults = DEFAULT_ORDER;
      const known = new Set(defaults.map((item) => item.to));
      const currentKnown = current.filter((item) => known.has(item.to));
      const defaultsToAdd = defaults.filter((item) => !currentKnown.find((existing) => existing.to === item.to));
      const isSameAsDefault = current.length === defaults.length && defaults.every((d, i) => current[i]?.to === d.to);
      if (isSameAsDefault) return defaults;
      if (defaultsToAdd.length === 0 && current.length === currentKnown.length) return current;
      return [...currentKnown, ...defaultsToAdd];
    });
  }, [user?.role]);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(navItems));
    } catch {
      // ignore
    }
  }, [navItems]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setNavItems((current) => {
      const fromIndex = current.findIndex((item) => item.to === active.id);
      const toIndex = current.findIndex((item) => item.to === over.id);
      if (fromIndex === -1 || toIndex === -1) return current;
      return arrayMove(current, fromIndex, toIndex);
    });
  }

  function resetOrder() {
    setNavItems(DEFAULT_ORDER);
    try {
      window.localStorage.removeItem(NAV_ORDER_KEY);
    } catch {
      // ignore
    }
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

  const currentPath = window.location.pathname;

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
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            {isReorderMode ? 'Drag to reorder' : 'Navigation'}
          </span>
          <div className="flex items-center gap-1">
            {isReorderMode ? (
              <button
                type="button"
                onClick={resetOrder}
                className="text-[10px] font-medium text-primary hover:text-primary-hover"
              >
                Reset
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsReorderMode((current) => !current)}
              className="text-[10px] font-medium text-primary hover:text-primary-hover"
            >
              {isReorderMode ? 'Done' : 'Reorder'}
            </button>
          </div>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={navItems.map((item) => item.to)} strategy={verticalListSortingStrategy}>
            <nav className="space-y-0.5">
              {navItems.map((item) => (
                <SortableNavItem
                  key={item.to}
                  item={item}
                  isReorderMode={isReorderMode}
                  isActive={item.to === currentPath}
                />
              ))}
            </nav>
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <div className="flex h-10 items-center gap-3 rounded-lg bg-surface px-3 shadow-elevated">
                <GripVertical className="h-3.5 w-3.5 text-ink-muted" />
                {(() => {
                  const item = navItems.find((i) => i.to === activeId);
                  const Icon = item ? iconMap[item.label as keyof typeof iconMap] : null;
                  return (
                    <>
                      {Icon && <Icon className="h-4 w-4" />}
                      <span className="text-sm font-medium text-ink">{item?.label}</span>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </aside>

      <main className="min-h-screen pl-0 pt-16 lg:pl-64">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
