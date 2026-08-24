import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, type PieLabelRenderProps } from 'recharts';
import { ChartContainer } from './ChartContainer';
import type { SupportDistributionItem } from '../types';

type Props = {
  data: SupportDistributionItem[];
  isLoading: boolean;
};

const RADIAN = Math.PI / 180;

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelRenderProps) {
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
  const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
  return (
    <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-medium">
      {`${((percent ?? 0) * 100).toFixed(0)}%`}
    </text>
  );
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: SupportDistributionItem }> }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-elevated">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.payload.color }} />
        <span className="text-sm font-medium text-ink">{item.name}</span>
      </div>
      <p className="mt-1 text-lg font-bold text-ink">{item.value.toLocaleString()}</p>
    </div>
  );
};

export function SupportDistributionChart({ data, isLoading }: Props) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const isEmpty = !data.length || total === 0;

  return (
    <ChartContainer
      title="Campaign Support Distribution"
      description="Breakdown of voter sentiment from call outcomes"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="No call outcome data available yet."
      csvData={data}
    >
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              labelLine
              label={renderCustomLabel}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-sm text-ink-secondary">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
