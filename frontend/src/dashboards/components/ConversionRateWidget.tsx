import { PhoneCall, PhoneOff, UserPlus, TrendingUp } from 'lucide-react';
import { ChartContainer } from './ChartContainer';
import type { ConversionData } from '../types';

type Props = { data: ConversionData; isLoading: boolean };

export function ConversionRateWidget({ data, isLoading }: Props) {
  const isEmpty = data.callsMade === 0 && data.answeredCalls === 0 && data.supportersGained === 0;

  return (
    <ChartContainer
      title="Support Conversion Rate"
      description="Call-to-supporter conversion funnel"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="No conversion data available yet."
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-hover p-4 transition-all hover:shadow-sm">
          <div className="flex items-center gap-2 text-sm text-ink-muted mb-1">
            <PhoneCall className="h-4 w-4 text-primary" />
            <span>Calls Made</span>
          </div>
          <p className="text-2xl font-bold text-ink">{data.callsMade.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-hover p-4 transition-all hover:shadow-sm">
          <div className="flex items-center gap-2 text-sm text-ink-muted mb-1">
            <PhoneOff className="h-4 w-4 text-warning" />
            <span>Answered</span>
          </div>
          <p className="text-2xl font-bold text-ink">{data.answeredCalls.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-hover p-4 transition-all hover:shadow-sm">
          <div className="flex items-center gap-2 text-sm text-ink-muted mb-1">
            <UserPlus className="h-4 w-4 text-success" />
            <span>Supporters Gained</span>
          </div>
          <p className="text-2xl font-bold text-success">{data.supportersGained.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-hover p-4 transition-all hover:shadow-sm">
          <div className="flex items-center gap-2 text-sm text-ink-muted mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>Conversion Rate</span>
          </div>
          <p className="text-2xl font-bold text-primary">{data.conversionRate}%</p>
        </div>
      </div>
    </ChartContainer>
  );
}

