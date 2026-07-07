import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { PageLoader, Avatar } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { BarsChart, TrendChart, DonutChart, PALETTE } from '../components/charts.jsx';

const pct = (n) => `${(n * 100).toFixed(0)}%`;

function Stat({ label, value, accent }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase font-semibold text-neutral-600 dark:text-neutral-400">{label}</div>
      <div className="font-heading text-3xl mt-1" style={{ color: accent || '#2a251f' }}>{value}</div>
    </div>
  );
}

export default function Analytics() {
  const { isType } = useAuth();
  const [d, setD] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const showAgents = !isType('owner');

  const load = () => {
    const p = new URLSearchParams();
    if (range.from) p.set('from', range.from);
    if (range.to) p.set('to', range.to);
    api.get(`/analytics?${p.toString()}`).then(setD).catch(() => {});
  };
  useEffect(load, [range]); // eslint-disable-line

  if (!d) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl text-neutral-900 dark:text-white">Analytics</h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-0.5">Performance across fields, campaigns and agents.</p>
        </div>
        <div className="flex items-end gap-2">
          <div><label className="label">From</label><input type="date" className="input !py-2" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></div>
          <div><label className="label">To</label><input type="date" className="input !py-2" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></div>
          {(range.from || range.to) && <button className="btn-ghost" onClick={() => setRange({ from: '', to: '' })}>Reset</button>}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total leads" value={d.summary.totalLeads} accent="#00A8A5" />
        <Stat label="Total spend" value={money(d.summary.totalSpend, true)} accent="#C0703B" />
        <Stat label="Blended CPL" value={money(d.summary.costPerLead)} accent="#4A6FA5" />
        <Stat label="Won value" value={money(d.fields.reduce((s, f) => s + f.wonValue, 0), true)} accent="#3E7C57" />
      </div>

      {/* Trend (leads vs won) + sources donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Leads vs won · last 12 months</h2>
          <TrendChart data={d.monthly} x="label" lines={[
            { key: 'count', name: 'New leads', color: '#00A8A5' },
            { key: 'won', name: 'Won', color: '#3E7C57' },
          ]} />
        </div>
        <div className="card p-6">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Lead sources</h2>
          <DonutChart data={d.sources} nameKey="source" valueKey="count" />
        </div>
      </div>

      {/* Field performance table */}
      <div className="card p-6">
        <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-1">Leads by field &amp; cost</h2>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">Volume, spend, cost-per-lead, conversion and return on ad spend per channel.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-300 dark:border-neutral-700">
              <th className="py-2 pr-4">Field</th><th className="py-2 px-4">Leads</th><th className="py-2 px-4">Won</th>
              <th className="py-2 px-4">Spend</th><th className="py-2 px-4">CPL</th><th className="py-2 px-4">Won value</th>
              <th className="py-2 px-4">ROI</th><th className="py-2 pl-4">Conversion</th></tr></thead>
            <tbody>
              {d.fields.map((c, i) => (
                <tr key={c.field} className="border-b border-neutral-200 dark:border-neutral-700 last:border-0">
                  <td className="py-3 pr-4 font-semibold text-neutral-900 dark:text-white"><span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{c.field}</span></td>
                  <td className="py-3 px-4 text-neutral-700 dark:text-neutral-200">{c.leads}</td>
                  <td className="py-3 px-4 text-accent-green font-semibold">{c.won}</td>
                  <td className="py-3 px-4 text-neutral-700 dark:text-neutral-200">{money(c.spend, true)}</td>
                  <td className="py-3 px-4 text-neutral-700 dark:text-neutral-200">{money(c.cpl)}</td>
                  <td className="py-3 px-4 text-neutral-700 dark:text-neutral-200">{money(c.wonValue, true)}</td>
                  <td className="py-3 px-4 font-semibold" style={{ color: c.roi >= 1 ? '#3E7C57' : '#A14B4B' }}>{c.roi ? `${c.roi.toFixed(1)}×` : '—'}</td>
                  <td className="py-3 pl-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden"><div className="h-full bg-primary-500 dark:bg-primary-600 rounded-full" style={{ width: pct(c.conversion) }} /></div>
                      <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">{pct(c.conversion)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Funnel + spend by field */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Conversion funnel</h2>
          <div className="space-y-2">
            {d.funnel.map((f) => {
              const max = Math.max(1, ...d.funnel.map((x) => x.count));
              return (
                <div key={f.name} className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 w-28 truncate">{f.name}</span>
                  <div className="flex-1 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                    <div className="h-full rounded-lg flex items-center px-3 text-xs font-bold text-white" style={{ width: `${(f.count / max) * 100}%`, background: f.color, minWidth: 40 }}>{f.count}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card p-6">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Spend by field</h2>
          <BarsChart data={d.spendByField} x="field" bars={[{ key: 'spend', name: 'Spend', color: '#C0703B' }]} fmt={(v) => money(v, true)} />
        </div>
      </div>

      {/* Budget distribution + priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Budget distribution</h2>
          <BarsChart data={d.budgetBuckets} x="bucket" bars={[{ key: 'count', name: 'Leads', color: '#4A6FA5' }]} />
        </div>
        <div className="card p-6">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Leads by priority</h2>
          <DonutChart data={d.byPriority} nameKey="priority" valueKey="count" />
        </div>
      </div>

      {/* Event performance */}
      <div className="card p-6">
        <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Event performance vs target</h2>
        <div className="space-y-3">
          {d.eventPerformance.map((e) => (
            <div key={e.id} className="flex items-center gap-4">
              <div className="w-40 min-w-0"><div className="font-semibold text-neutral-900 dark:text-white truncate">{e.name}</div><div className="text-xs text-neutral-600 dark:text-neutral-400">{e.leads} leads · {e.won} won · {money(e.spend, true)}</div></div>
              <div className="flex-1 h-6 rounded-lg bg-neutral-200 dark:bg-neutral-700 overflow-hidden"><div className="h-full bg-primary-500 dark:bg-primary-600 rounded-lg flex items-center justify-end px-2 text-[11px] font-bold text-white" style={{ width: `${Math.min(100, e.attainment * 100)}%`, minWidth: 30 }}>{pct(e.attainment)}</div></div>
              <span className="text-xs text-neutral-600 dark:text-neutral-400 w-20 text-right">target {e.target}</span>
            </div>
          ))}
          {d.eventPerformance.length === 0 && <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center py-4">No events yet.</p>}
        </div>
      </div>

      {/* Agent leaderboard */}
      {showAgents && (
        <div className="card p-6">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Agent leaderboard</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {d.leaderboard.map((a, i) => {
              const max = Math.max(1, ...d.leaderboard.map((x) => x.won));
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="font-heading text-lg text-neutral-500 dark:text-neutral-500 w-5">{i + 1}</span>
                  <Avatar name={a.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{a.name}</div>
                    <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden mt-1"><div className="h-full bg-accent-green rounded-full" style={{ width: `${(a.won / max) * 100}%` }} /></div>
                  </div>
                  <div className="text-right"><div className="text-sm font-bold text-neutral-900 dark:text-white">{a.won} won</div><div className="text-xs text-neutral-600 dark:text-neutral-400">{money(a.wonValue, true)}</div></div>
                </div>
              );
            })}
            {d.leaderboard.length === 0 && <p className="text-sm text-neutral-600 dark:text-neutral-400">No agent data.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
