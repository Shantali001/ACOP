import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { ChartContainer } from './ChartContainer';
import type { AgentCallsData } from '../types';

type Props = { data: AgentCallsData[]; isLoading: boolean };

const COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-elevated">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="text-lg font-bold text-primary">{payload[0].value.toLocaleString()} calls</p>
    </div>
  );
};

export function CallsPerAgentChart({ data, isLoading }: Props) {
  return (
    <ChartContainer
      title="Calls Made Per Agent"
      description="Total number of calls completed by each agent"
      isLoading={isLoading}
      isEmpty={!data.length}
      emptyMessage="No call data available yet."
      csvData={data}
    >
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
}
