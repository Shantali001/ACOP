import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, Globe, Users, LayoutList, LayoutGrid } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { getSituationRoomSummary, getSituationRoomGeo, getSituationRoomStale, getSituationRoomIncidents, getProjection, getElectionTargets } from '../election/api';
import type { GeoRollupItem, Incident, Projection, SituationRoomSummary } from '../election/types';

type GeoLevel = 'state' | 'lga' | 'ward';
type ViewMode = 'stacked' | 'card';

const VIEW_STORAGE_KEY = 'situation-room-view-mode';

function numberFormat(value: number) {
  return new Intl.NumberFormat().format(value);
}

function readPersistedViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'stacked';
  try {
    const stored = window.sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'stacked' || stored === 'card') return stored;
  } catch {
    // ignore
  }
  return 'stacked';
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

  const [viewMode, setViewMode] = useState<ViewMode>(() => readPersistedViewMode());
  const [activePanelIndex, setActivePanelIndex] = useState(0);
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  useEffect(() => {
    try {
      window.sessionStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

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

  useEffect(() => {
    if (viewMode !== 'card') return;
    const container = cardContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      panelRefs.current.forEach((panel, index) => {
        if (!panel) return;
        const distance = Math.abs(panel.getBoundingClientRect().top - containerTop);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      setActivePanelIndex(closestIndex);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'card') return;
    const handleResize = () => {
      const target = panelRefs.current[activePanelIndex];
      const container = cardContainerRef.current;
      if (target && container) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode, activePanelIndex]);

  const scrollToPanel = (index: number) => {
    const target = panelRefs.current[index];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActivePanelIndex(index);
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

  const panelLabels = [
    'Stats',
    'Live Projection',
    'Geographic Coverage',
    'Results',
    'Stale PUs',
    'Incident Feed',
  ];

  const renderHeaderStats = (inCard: boolean) => {
    if (isLoading) {
      return (
        <div className={inCard ? 'flex h-full flex-col justify-center' : ''}>
          {inCard && <h2 className="text-card font-semibold text-ink mb-4">Header stats</h2>}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><div className="px-6 py-5"><div className="skeleton h-8 w-24" /></div></Card>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className={inCard ? 'flex h-full flex-col justify-center' : ''}>
        {inCard && <h2 className="text-card font-semibold text-ink mb-4">Header stats</h2>}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>
    );
  };

  const renderLiveProjection = (inCard: boolean) => (
    <div className={inCard ? 'flex h-full flex-col justify-center' : ''}>
      {inCard && <h2 className="text-card font-semibold text-ink mb-4">Live Projection</h2>}
      <Card title={inCard ? undefined : 'Live Projection'}>
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
    </div>
  );

  const renderResults = () => (
    <Card title="Results">
      <div className="px-6 py-5">
        <p className="text-sm text-ink-muted">Party/candidate tallies are aggregated from polling unit reports below.</p>
        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-table text-ink-muted">Our Votes</p>
            <p className="mt-2 text-section font-semibold text-ink">{numberFormat(projection?.ourVotes ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-table text-ink-muted">Vote Share</p>
            <p className="mt-2 text-section font-semibold text-ink">{projection?.currentVoteSharePercent ?? 0}%</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-table text-ink-muted">Projected Final</p>
            <p className="mt-2 text-section font-semibold text-ink">{numberFormat(projection?.projectedFinalVotes ?? 0)}</p>
          </div>
        </div>
      </div>
    </Card>
  );

  const renderGeo = (inCard: boolean) => (
    <div className={inCard ? 'flex h-full flex-col justify-center' : ''}>
      {inCard && <h2 className="text-card font-semibold text-ink mb-4">Geographic Coverage</h2>}
      <Card title={inCard ? undefined : 'Geographic Coverage'}>
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
  );

  const renderStalePus = (inCard: boolean) => (
    <div className={inCard ? 'flex h-full flex-col justify-center' : ''}>
      {inCard && <h2 className="text-card font-semibold text-ink mb-4">Stale PUs</h2>}
      <Card title={inCard ? undefined : 'Overdue Polling Units'}>
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
    </div>
  );

  const renderIncidents = (inCard: boolean) => (
    <div className={inCard ? 'flex h-full flex-col justify-center' : ''}>
      {inCard && <h2 className="text-card font-semibold text-ink mb-4">Incident Feed</h2>}
      <Card title={inCard ? undefined : 'Incident Feed'}>
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
  );

  const stackedPanels = [
    <div key="header-stats">{renderHeaderStats(false)}</div>,
    <div key="live-projection">{renderLiveProjection(false)}</div>,
    <div key="results">{renderResults()}</div>,
    <div key="geo">{renderGeo(false)}</div>,
    <div key="stale-pus">{renderStalePus(false)}</div>,
    <div key="incidents">{renderIncidents(false)}</div>,
  ];

  const renderCardPanel = (renderFn: (inCard: boolean) => React.ReactNode, index: number) => (
    <div
      key={index}
      ref={(el) => { panelRefs.current[index] = el; }}
      className="situation-room-panel"
      data-panel-index={index}
    >
      {renderFn(true)}
    </div>
  );

  // renderResults has no inCard-dependent layout, so pass-through.
  const renderResultsCard = () => <>{renderResults()}</>;

  return (
    <section className={viewMode === 'card' ? 'situation-room-card-wrapper' : 'py-6 space-y-6'}>
      <div className={viewMode === 'card' ? 'situation-room-card-header px-4 sm:px-6 lg:px-8 pt-6' : ''}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-page font-bold text-ink">Situation Room</h1>
            <p className="mt-1 text-body text-ink-muted">
              Live election monitoring dashboard. Data generated at: {new Date().toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 self-start sm:self-auto" role="tablist" aria-label="View mode">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'stacked'}
              onClick={() => setViewMode('stacked')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'stacked' ? 'bg-primary text-white shadow-sm' : 'text-ink-muted hover:bg-hover hover:text-ink'
              }`}
            >
              <LayoutList className="h-4 w-4" />
              Stacked
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'card'}
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'card' ? 'bg-primary text-white shadow-sm' : 'text-ink-muted hover:bg-hover hover:text-ink'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Card
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
      </div>

      {viewMode === 'stacked' ? (
        <div className="px-4 sm:px-6 lg:px-8 space-y-6 pt-6">
          {stackedPanels.map((panel) => panel)}
        </div>
      ) : (
        <>
          <div ref={cardContainerRef} className="situation-room-card-view">
            {renderCardPanel(renderHeaderStats, 0)}
            {renderCardPanel(renderLiveProjection, 1)}
            {renderCardPanel(renderResultsCard, 2)}
            {renderCardPanel(renderGeo, 3)}
            {renderCardPanel(renderStalePus, 4)}
            {renderCardPanel(renderIncidents, 5)}
          </div>
          <nav className="situation-room-dot-indicator" aria-label="Panel navigation">
            {panelLabels.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => scrollToPanel(index)}
                aria-label={`Scroll to ${label} panel`}
                aria-current={activePanelIndex === index ? 'true' : undefined}
                className={`situation-room-dot ${activePanelIndex === index ? 'is-active' : ''}`}
              />
            ))}
          </nav>
        </>
      )}
    </section>
  );
}
