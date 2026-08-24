import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}</span>
          </div>
          <span className="font-semibold">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export function SupportersVsOppositionLGA({ data, isLoading }: Props) {
  return (
    <ChartContainer
      title="Supporters vs Opposition by LGA"
      description="Compare political strength across LGAs"
      isLoading={isLoading}
      isEmpty={!data.length}
      emptyMessage="No LGA-level data available yet."
      csvData={data}
    >
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
}
