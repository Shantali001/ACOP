import { TrendingUp, TrendingDown, Users, UserX, UserMinus, UserPlus, PhoneCall, Activity, Target } from 'lucide-react';
import type { SummaryCards as SummaryCardsType } from '../types';

type SummaryCardsProps = { data: SummaryCardsType; isLoading: boolean };

const cardConfig = [
  { key: 'totalSupporters', label: 'Total Supporters', icon: Users, color: 'text-success', bg: 'bg-success-light' },
  { key: 'totalOpposition', label: 'Total Opposition', icon: UserX, color: 'text-danger', bg: 'bg-danger-light' },
  { key: 'totalUndecided', label: 'Total Undecided', icon: UserMinus, color: 'text-warning', bg: 'bg-warning-light' },
  { key: 'newSupportersToday', label: 'New Supporters Today', icon: UserPlus, color: 'text-primary', bg: 'bg-primary-light' },
  { key: 'newSupportersThisWeek', label: 'New Supporters This Week', icon: UserPlus, color: 'text-primary', bg: 'bg-primary-light' },
  { key: 'callsMadeToday', label: 'Calls Made Today', icon: PhoneCall, color: 'text-info', bg: 'bg-info-light' },
  { key: 'activeAgents', label: 'Active Agents', icon: Activity, color: 'text-success', bg: 'bg-success-light' },
  { key: 'totalRegisteredSupporters', label: 'Registered Supporters', icon: Target, color: 'text-primary', bg: 'bg-primary-light' },
];

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cardConfig.map((config) => {
        const cardData = data[config.key as keyof SummaryCardsType];
        const Icon = config.icon;
        const isPositive = cardData.change > 0;
        const isNegative = cardData.change < 0;
        return (
          <div key={config.key} className="card card-hover group relative overflow-hidden transition-all duration-200">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-muted">{config.label}</span>
                <div className={`rounded-xl p-2.5 ${config.bg} ${config.color} transition-transform duration-200 group-hover:scale-110`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              {isLoading ? (
                <div className="mt-4 space-y-2">
                  <div className="skeleton h-8 w-24" />
                  <div className="skeleton h-4 w-16" />
                </div>
              ) : (
                <div className="mt-4">
                  <div className="text-2xl font-bold text-ink">{cardData.value.toLocaleString()}</div>
                  <div className="mt-1.5 flex items-center gap-1">
                    {isPositive && <><TrendingUp className="h-3.5 w-3.5 text-success" /><span className="text-xs font-semibold text-success">+{cardData.change}%</span></>}
                    {isNegative && <><TrendingDown className="h-3.5 w-3.5 text-danger" /><span className="text-xs font-semibold text-danger">{cardData.change}%</span></>}
                    {!isPositive && !isNegative && <span className="text-xs text-ink-muted">No change</span>}
                    <span className="text-xs text-ink-muted ml-1">vs yesterday</span>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-30" />
          </div>
        );
      })}
    </div>
  );
}
