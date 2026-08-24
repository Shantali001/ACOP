import { Crown, Medal, Award, Phone, UserPlus, TrendingUp } from 'lucide-react';
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
    <ChartContainer
      title="Agent Performance Leaderboard"
      description="Top performing agents ranked by supporters registered"
      isLoading={isLoading}
      isEmpty={!data.length}
      emptyMessage="No agent performance data available yet."
    >
      <div className="space-y-3">
        {top3.map((agent, index) => {
          const RankIcon = rankIcons[index];
          return (
            <div key={agent.agentId} className={`flex items-center gap-4 rounded-xl p-4 transition-all hover:shadow-md ${rankBgColors[index]}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                <RankIcon className={`h-5 w-5 ${rankColors[index]}`} />
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
            </div>
          );
        })}
        {rest.length > 0 && (
          <div className="pt-2 space-y-2">
            {rest.map((agent) => (
              <div key={agent.agentId} className="flex items-center gap-4 rounded-xl px-4 py-3 hover:bg-hover transition">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-hover text-xs font-bold text-ink-muted">
                  {data.indexOf(agent) + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{agent.agentName}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-ink-muted">
                  <span>{agent.callsCompleted} calls</span>
                  <span className="text-success">{agent.supportersRegistered} supporters</span>
                  <span className="text-primary">{agent.successRate}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartContainer>
  );
}
