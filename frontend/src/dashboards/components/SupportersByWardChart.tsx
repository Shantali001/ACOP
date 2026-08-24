import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer } from './ChartContainer';
import type { WardData } from '../types';

type Props = { data: WardData[]; isLoading: boolean };

const COLORS = ['#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-elevated">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="text-lg font-bold text-success">{payload[0].value.toLocaleString()} supporters</p>
    </div>
  );
};

export function SupportersByWardChart({ data, isLoading }: Props) {
  return (
    <ChartContainer
      title="Supporters by Ward"
      description="Supporter count distributed across wards"
      isLoading={isLoading}
      isEmpty={!data.length}
      emptyMessage="No ward-level data available yet."
      csvData={data}
    >
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
}
