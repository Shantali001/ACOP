import { Clock, User, Activity as ActivityIcon } from 'lucide-react';
import { ChartContainer } from './ChartContainer';
import type { ActivityItem } from '../types';

type Props = {
  data: ActivityItem[];
  isLoading: boolean;
};

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecentActivity({ data, isLoading }: Props) {
  return (
    <ChartContainer
      title="Recent Activity"
      description="Latest campaign actions and events"
      isLoading={isLoading}
      isEmpty={!data.length}
      emptyMessage="No recent activity recorded yet."
    >
      <div className="space-y-1">
        {data.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 rounded-xl px-4 py-3 transition hover:bg-hover"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
              <ActivityIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-ink truncate">{item.userName}</span>
                <span className="text-ink-muted">·</span>
                <span className="text-xs text-ink-muted whitespace-nowrap">
                  {formatAction(item.action)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                <User className="h-3 w-3" />
                <span className="truncate">{item.entityType}</span>
                <Clock className="h-3 w-3 ml-1" />
                <span className="whitespace-nowrap">{getRelativeTime(item.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ChartContainer>
  );
}

