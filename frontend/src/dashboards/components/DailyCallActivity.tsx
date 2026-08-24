import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';
import type { CallActivityData } from '../types';

type Props = { data: CallActivityData[]; isLoading: boolean; onPeriodChange: (period: string) => void };

const periods = [
  { v: 'daily', l: 'Today' },
  { v: 'weekly', l: 'Weekly' },
  { v: 'monthly', l: 'Monthly' },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-elevated">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="text-lg font-bold text-info">{payload[0].value.toLocaleString()} calls</p>
    </div>
  );
};

export function DailyCallActivity({ data, isLoading, onPeriodChange }: Props) {
  const [activePeriod, setActivePeriod] = useState('weekly');
  const handleClick = (p: string) => { setActivePeriod(p); onPeriodChange(p); };

  return (
    <ChartContainer
      title="Daily Call Activity"
      description="Number of calls made each day"
      isLoading={isLoading}
      isEmpty={!data.length}
      emptyMessage="No call activity data available yet."
      csvData={data}
      actions={
        <div className="flex gap-1 rounded-lg bg-hover p-0.5">
          {periods.map((p) => (
            <button key={p.v} type="button" onClick={() => handleClick(p.v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${activePeriod === p.v ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>{p.l}</button>
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
            <Line type="monotone" dataKey="calls" name="Calls" stroke="#0284C7" strokeWidth={2.5}
              dot={{ fill: '#0284C7', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2, fill: '#fff', stroke: '#0284C7' }}
              animationDuration={600} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
