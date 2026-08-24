const fs = require('fs');
const path = require('path');

const componentsDir = __dirname;

const files = {
  'NewSupportersTrend.tsx': `import { useState } from 'react';
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
              className={\`rounded-md px-2.5 py-1 text-xs font-medium transition \${activePeriod === p.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}\`}>{p.label}</button>
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
}`,

  'CallsPerAgentChart.tsx': `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { ChartContainer } from './ChartContainer';
import type { AgentCallsData } from '../types';

type Props = { data: AgentCallsData[]; isLoading: boolean };
const COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-elevated"><p className="text-sm font-medium text-ink">{label}</p><p className="text-lg font-bold text-primary">{payload[0].value.toLocaleString()} calls</p></div>;
};

export function CallsPerAgentChart({ data, isLoading }: Props) {
  return (
    <ChartContainer title="Calls Made Per Agent" description="Total number of calls completed by each agent"
      isLoading={isLoading} isEmpty={!data.length} emptyMessage="No call data available yet." csvData={data}>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -8 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis dataKey="agentName" type="category" tick={{ fontSize: 13, fill: '#374151' }} tickLine={false} axisLine={false} width={100} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="calls" name="Calls Made" radius={[0, 6, 6, 0]} animationDuration={600} maxBarSize={32}>
              {data.map((_e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}`,

  'SupportersByWardChart.tsx': `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer } from './ChartContainer';
import type { WardData } from '../types';

type Props = { data: WardData[]; isLoading: boolean };
const COLORS = ['#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-elevated"><p className="text-sm font-medium text-ink">{label}</p><p className="text-lg font-bold text-success">{payload[0].value.toLocaleString()} supporters</p></div>;
};

export function SupportersByWardChart({ data, isLoading }: Props) {
  return (
    <ChartContainer title="Supporters by Ward" description="Supporter count distributed across wards"
      isLoading={isLoading} isEmpty={!data.length} emptyMessage="No ward-level data available yet." csvData={data}>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="ward" tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Supporters" radius={[6, 6, 0, 0]} animationDuration={600} maxBarSize={40}>
              {data.map((_e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}`,

  'SupportersVsOppositionLGA.tsx': `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';
import type { LGAData } from '../types';

type Props = { data: LGAData[]; isLoading: boolean };

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-elevated">
      <p className="text-sm font-semibold text-ink mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} /><span>{entry.name}</span></div>
          <span className="font-semibold">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export function SupportersVsOppositionLGA({ data, isLoading }: Props) {
  return (
    <ChartContainer title="Supporters vs Opposition by LGA" description="Compare political strength across LGAs"
      isLoading={isLoading} isEmpty={!data.length} emptyMessage="No LGA-level data available yet." csvData={data}>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="lga" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="supporters" name="Supporters" fill="#16A34A" radius={[4, 4, 0, 0]} maxBarSize={20} animationDuration={600} />
            <Bar dataKey="opposition" name="Opposition" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={20} animationDuration={600} />
            <Bar dataKey="undecided" name="Undecided" fill="#D97706" radius={[4, 4, 0, 0]} maxBarSize={20} animationDuration={600} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}`,

  'AgentLeaderboard.tsx': `import { Crown, Medal, Award, Phone, UserPlus, TrendingUp } from 'lucide-react';
import { ChartContainer } from './ChartContainer';
import type { AgentLeaderboardEntry } from '../types';

type Props = { data: AgentLeaderboardEntry[]; isLoading: boolean };

const rankIcons = [Crown, Medal, Award];
const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
const rankBgColors = ['bg-yellow-50', 'bg-gray-50', 'bg-amber-50'];

export function AgentLeaderboard({ data, isLoading }: Props) {
  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <ChartContainer title="Agent Performance Leaderboard" description="Top performing agents ranked by supporters registered"
      isLoading={isLoading} isEmpty={!data.length} emptyMessage="No agent performance data available yet.">
      <div className="space-y-3">
        {top3.map((agent, index) => {
          const RankIcon = rankIcons[index];
          return (
            <div key={agent.agentId} className={\`flex items-center gap-4 rounded-xl p-4 transition-all hover:shadow-md \${rankBgColors[index]}\`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                <RankIcon className={\`h-5 w-5 \${rankColors[index]}\`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{agent.agentName}</p>
                <p className="text-xs text-ink-muted truncate">{agent.email}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-xs text-ink-muted"><Phone className="h-3 w-3" /><span>Calls</span></div>
                  <p className="text-sm font-bold text-ink">{agent.callsCompleted}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-xs text-ink-muted"><UserPlus className="h-3 w-3" /><span>Supporters</span></div>
                  <p className="text-sm font-bold text-success">{agent.supportersRegistered}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-xs text-ink-muted"><TrendingUp className="h-3 w-3" /><span>Rate</span></div>
                  <p className="text-sm font-bold text-primary">{agent.successRate}%</p>
                </div>
            </div>
          );
        })}
        {rest.length > 0 && (
          <div className="pt-2 space-y-2">
            {rest.map((agent) => (
              <div key={agent.agentId} className="flex items-center gap-4 rounded-xl px-4 py-3 hover:bg-hover transition">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-hover text-xs font-bold text-ink-muted">{data.indexOf(agent) + 1}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-ink truncate">{agent.agentName}</p></div>
                <div className="flex items-center gap-4 text-xs text-ink-muted">
                  <span>{agent.callsCompleted} calls</span>
                  <span className="text-success">{agent.supportersRegistered} supporters</span>
                  <span className="text-primary">{agent.successRate}%</span>
                </div>
            ))}
          </div>
        )}
      </div>
    </ChartContainer>
  );
}`,

  'DailyCallActivity.tsx': `import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';
import type { CallActivityData } from '../types';

type Props = { data: CallActivityData[]; isLoading: boolean; onPeriodChange: (period: string) => void };
const periods = [{ v: 'daily', l: 'Today' }, { v: 'weekly', l: 'Weekly' }, { v: 'monthly', l: 'Monthly' }];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-elevated"><p className="text-sm text-ink-muted">{label}</p><p className="text-lg font-bold text-info">{payload[0].value.toLocaleString()} calls</p></div>;
};

export function DailyCallActivity({ data, isLoading, onPeriodChange }: Props) {
  const [activePeriod, setActivePeriod] = useState('weekly');
  const handleClick = (p: string) => { setActivePeriod(p); onPeriodChange(p); };

  return (
    <ChartContainer title="Daily Call Activity" description="Number of calls made each day"
      isLoading={isLoading} isEmpty={!data.length} emptyMessage="No call activity data available yet."
      csvData={data}
      actions={
        <div className="flex gap-1 rounded-lg bg-hover p-0.5">
          {periods.map((p) => (
            <button key={p.v} type="button" onClick={() => handleClick(p.v)}
              className={\`rounded-md px-2.5 py-1 text-xs font-medium transition \${activePeriod === p.v ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}\`}>{p.l}</button>
          ))}
        </div>
      }>
      <div className="h
