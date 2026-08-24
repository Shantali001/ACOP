import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Globe, Users } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { getSituationRoomSummary, getSituationRoomGeo, getSituationRoomStale, getSituationRoomIncidents, getProjection, getElectionTargets } from '../election/api';
import type { GeoRollupItem, Incident, Projection, SituationRoomSummary } from '../election/types';

type GeoLevel = 'state' | 'lga' | 'ward';

function numberFormat(value: number) {
  return new Intl.NumberFormat().format(value);
}

export function SituationRoomPage() {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<SituationRoomSummary | null>(null);
  const [geoLevel, setGeoLevel] = useState<GeoLevel>('lga');
  const [geoData, setGeoData] = useState<GeoRollupItem[]>([]);
  const [stalePus, setStalePus] = useState<{ id: string; puCode: string; puName: string; ward: string; lga: string; state: string; lastCalledAt: string | null; checkInIntervalMinutes: number; dueAt: string }[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [target, setTarget] = useState<{ votesNeededToWin: number; expectedTurnoutPercent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let active = true;
    async function load() {
      setIsLoading(true);
      try {
        const [sum, geo, stale, inc, proj, tgt] = await Promise.all([
          getSituationRoomSummary(token!),
          getSituationRoomGeo(token!, geoLevel),
          getSituationRoomStale(token!),
          getSituationRoomIncidents(token!),
          getProjection(token!),
          getElectionTargets(token!),
        ]);
        if (!active) return;
        setSummary(sum);
        setGeoData(geo.data);
        setStalePus(stale.data);
        setIncidents(inc.data);
        setProjection(proj);
        setTarget(tgt.target ? { votesNeededToWin: tgt.target.votesNeededToWin, expectedTurnoutPercent: tgt.target.expectedTurnoutPercent } : null);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load situation room.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [token, geoLevel]);

  const votesPerPuTarget = useMemo(() => {
    if (!projection || !target || projection.totalPus === 0) return null;
    return Math.round(target.votesNeededToWin / projection.totalPus);
  }, [projection, target]);

  const severityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'neutral';
    }
  };

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR')) {
    return (
      <section className="py-6">
        <Card>
          <div className="px-6 py-6 text-center text-ink-muted">You do not have access to the Situation Room.</div>
        </Card>
      </section>
    );
  }

  return (
    <section className="py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-page font-bold text-ink">Situation Room</h1>
        <p className="text-body text-ink-muted">
          Live election monitoring dashboard. Data generated at: {new Date().toLocaleString()}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><div className="px-6 py-5"><div className="skeleton h-8 w-24" /></div></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <div className="px-6 py-5 flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary-light text-primary"><Globe size={20} /></div>
              <div>
                <p className="text-table text-ink-muted">Coverage</p>
                <p className="text-section font-semibold text-ink">{summary?.coveragePercent ?? 0}%</p>
                <p className="text-xs text-ink-muted">{summary?.pusReported ?? 0} of {summary?.totalPus ?? 0} PUs</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="px-6 py-5 flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-success-light text-success"><Users size={20} /></div>
              <div>
                <p className="text-table text-ink-muted">Turnout</p>
                <p className="text-section font-semibold text-ink">{summary?.turnoutPercent ?? 0}%</p>
                <p className="text-xs text-ink-muted">{numberFormat(summary?.totalAccreditedVoters ?? 0)} accredited</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="px-6 py-5 flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-info-light text-info"><BarChart3 size={20} /></div>
              <div>
                <p className="text-table text-ink-muted">Our Votes</p>
                <p className="text-section font-semibold text-ink">{numberFormat(projection?.ourVotes ?? 0)}</p>
                <p className="text-xs text-ink-muted">{projection?.currentVoteSharePercent ?? 0}% share so far</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="px-6 py-5 flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning-light text-warning"><Activity size={20} /></div>
              <div>
                <p className="text-table text-ink-muted">Confidence</p>
                <p className="text-section font-semibold text-ink">{projection?.confidenceLevel ?? 'Low'}</p>
                <p className="text-xs text-ink-muted">{projection?.coveragePercent ?? 0}% coverage</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!isLoading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Live Projection">
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-table text-ink-muted">Projected Final Votes</p>
                  <p className="text-section font-semibold text-ink">{numberFormat(projection?.projectedFinalVotes ?? 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-table text-ink-muted">Needed to Win</p>
                  <p className="text-section font-semibold text-ink">{numberFormat(target?.votesNeededToWin ?? 0)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-table text-ink-muted">Target per PU</p>
                  <p className="text-section font-semibold text-ink">{votesPerPuTarget ?? '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-table text-ink-muted">Expected Turnout</p>
                  <p className="text-section font-semibold text-ink">{target?.expectedTurnoutPercent ?? 0}%</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-ink-muted">
                Provisional estimate based on {projection?.coveragePercent ?? 0}% of polling units reporting. Early results may not represent the full area — check the geographic breakdown for balance before drawing conclusions.
              </div>
            </div>
          </Card>

          <Card title="Geographic Coverage">
            <div className="px-6 py-5">
              <div className="flex gap-2 mb-4">
                {(['state', 'lga', 'ward'] as GeoLevel[]).map((level) => (
                  <button key={level} onClick={() => setGeoLevel(level)} className={`btn btn-sm ${geoLevel === level ? 'btn-primary' : 'btn-secondary'}`}>
                    {level.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      {geoLevel !== 'ward' && <th>State</th>}
                      {geoLevel === 'lga' && <th>LGA</th>}
                      {geoLevel === 'ward' && <th>Ward</th>}
                      <th>Total PUs</th>
                      <th>Reported</th>
                      <th>Coverage</th>
                      <th>Turnout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {geoData.length === 0 ? (
                      <tr><td colSpan={geoLevel === 'state' ? 5 : geoLevel === 'lga' ? 6 : 6} className="text-center text-ink-muted">No data yet.</td></tr>
                    ) : (
                      geoData.map((row, idx) => (
                        <tr key={idx}>
                          {geoLevel !== 'ward' && <td>{row.state}</td>}
                          {geoLevel === 'lga' && <td>{row.lga}</td>}
                          {geoLevel === 'ward' && <td>{row.ward}</td>}
                          <td>{row.total_pus}</td>
                          <td>{row.pus_reported}</td>
                          <td>{row.total_pus > 0 ? Math.round((row.pus_reported / row.total_pus) * 100) : 0}%</td>
                          <td>{row.registered_voters > 0 ? Math.round((row.accredited_voters / row.registered_voters) * 100) : 0}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!isLoading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Overdue Polling Units">
            <div className="px-6 py-5">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>PU Code</th>
                      <th>Name</th>
                      <th>Ward</th>
                      <th>LGA</th>
                      <th>Last Called</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stalePus.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-ink-muted">No overdue polling units.</td></tr>
                    ) : (
                      stalePus.map((pu) => (
                        <tr key={pu.id}>
                          <td className="font-medium">{pu.puCode}</td>
                          <td>{pu.puName}</td>
                          <td>{pu.ward}</td>
                          <td>{pu.lga}</td>
                          <td>{pu.lastCalledAt ? new Date(pu.lastCalledAt).toLocaleString() : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card title="Incident Feed">
            <div className="px-6 py-5">
              {incidents.length === 0 ? (
                <p className="text-sm text-ink-muted">No incidents reported yet.</p>
              ) : (
                <div className="space-y-3">
                  {incidents.slice(0, 20).map((inc) => (
                    <div key={inc.id} className="flex items-start justify-between gap-4 rounded-lg border border-border px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={severityVariant(inc.severity)}>{inc.severity}</Badge>
                          <span className="text-sm font-medium text-ink">{inc.category}</span>
                        </div>
                        {inc.description && <p className="mt-1 text-sm text-ink-secondary">{inc.description}</p>}
                        <p className="mt-1 text-xs text-ink-muted">{new Date(inc.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
