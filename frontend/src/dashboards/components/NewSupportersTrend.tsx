import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';
import type { TrendDataPoint } from '../types';

type Props = { data: TrendDataPoint[]; isLoading: boolean; onPeriodChange: (period: string) => void };

const periods = [
  { value: '24h', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '12m', label: '12 Months' },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-elevated">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="text-lg font-bold text-primary">{payload[0].value.toLocaleString()} supporters</p>
    </div>
  );
};

export function NewSupportersTrend({ data, isLoading, onPeriodChange }: Props) {
  const [activePeriod, setActivePeriod] = useState('7d');
  const handlePeriodClick = (period: string) => { setActivePeriod(period); onPeriodChange(period); };

  return (
    <ChartContainer title="New Supporters Trend" description="How many new supporters joined over time"
      isLoading={isLoading} isEmpty={!data.length} emptyMessage="No supporter trend data available yet."
      csvData={data}
      actions={
        <div className="flex gap-1 rounded-lg bg-hover p-0.5">
          {periods.map((p) => (
            <button key={p.value} type="button" onClick={() => handlePeriodClick(p.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${activePeriod === p.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>{p.label}</button>
          ))}
        </div>
      }>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false}
              tickFormatter={(v: string) => v.length > 10 ? v.slice(5, 10) : v} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="count" name="Supporters" stroke="#2563EB" strokeWidth={2.5}
              dot={{ fill: '#2563EB', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2, fill: '#fff', stroke: '#2563EB' }}
              animationDuration={600} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
