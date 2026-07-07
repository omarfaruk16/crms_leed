import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api.js';
import { money, relTime } from '../lib/format.js';
import { PageLoader, Avatar } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { BarsChart, TrendChart, DonutChart } from '../components/charts.jsx';

const ACT_ICON = { call: '📞', email: '✉', whatsapp: '💬', note: '📝', viewing: '👁', stage_change: '↗', system: '⚙' };

function KpiCard({ label, value, sub, accent, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ y: -4, boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15), 0 10px 10px rgba(0, 0, 0, 0.05)' }}
      className="card p-5 transition-all duration-300"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">{label}</div>
      <motion.div
        className="font-heading text-3xl font-bold text-neutral-900 dark:text-white mt-2"
        style={{ color: accent }}
      >
        {value}
      </motion.div>
      {sub && <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{sub}</div>}
    </motion.div>
  );
}

export default function Dashboard() {
  const { user, isType } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => { api.get('/dashboard').then(setData).catch(() => {}); }, []);
  if (!data) return <PageLoader />;

  const { kpis, followups, pipeline, recent, trend, fields, affiliate } = data;
  const affiliateView = isType('affiliate');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl text-neutral-900 dark:text-white">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">
            {affiliateView ? 'Your referred leads and earnings at a glance.' : "Here's what's happening across your pipeline today."}
          </p>
        </div>
        {!affiliateView && (
          <div className="text-right">
            <div className="text-xs uppercase font-semibold text-neutral-600 dark:text-neutral-400">Cost per lead</div>
            <div className="font-heading text-2xl text-accent-orange">{money(kpis.costPerLead)}</div>
          </div>
        )}
      </div>

      {/* Affiliate income banner */}
      {affiliate && (
        <div className="card p-6 bg-gradient-to-br from-primary-500/10 to-accent-green/5 border-primary-500 dark:border-primary-400/30 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><div className="text-xs uppercase font-semibold text-neutral-600 dark:text-neutral-400">Total income</div><div className="font-heading text-3xl text-accent-green mt-1">{money(affiliate.totalIncome)}</div></div>
          <div><div className="text-xs uppercase font-semibold text-neutral-600 dark:text-neutral-400">Won leads</div><div className="font-heading text-3xl text-neutral-900 dark:text-white mt-1">{affiliate.wonLeads}</div></div>
          <div><div className="text-xs uppercase font-semibold text-neutral-600 dark:text-neutral-400">My leads</div><div className="font-heading text-3xl text-neutral-900 dark:text-white mt-1">{affiliate.myLeads}</div></div>
          <div><div className="text-xs uppercase font-semibold text-neutral-600 dark:text-neutral-400">Per won lead</div><div className="font-heading text-3xl text-primary-500 dark:text-primary-400 mt-1">{money(affiliate.incomePerLead)}</div></div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard index={0} label="Total leads" value={kpis.totalLeads} accent="#0ea5e9" sub={`${kpis.new30d} new in 30 days`} />
        <KpiCard index={1} label="Open pipeline" value={kpis.openLeads} accent="#3b82f6" sub={money(kpis.pipelineValue, true) + ' value'} />
        <KpiCard index={2} label="Won deals" value={kpis.wonLeads} accent="#10b981" sub={`${(kpis.winRate * 100).toFixed(0)}% win rate · ${money(kpis.wonValue, true)}`} />
        <KpiCard index={3} label="Follow-ups due" value={kpis.dueSoon} accent="#f97316" sub={`${kpis.overdue} overdue`} />
      </div>

      {/* Trend + pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="card p-6 lg:col-span-2"
        >
          <h2 className="font-heading text-xl font-bold text-neutral-900 dark:text-white mb-4">New leads · last 6 months</h2>
          <TrendChart area data={trend} x="label" lines={[{ key: 'count', name: 'Leads', color: '#0ea5e9' }]} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="card p-6"
        >
          <h2 className="font-heading text-xl font-bold text-neutral-900 dark:text-white mb-4">Pipeline by stage</h2>
          <DonutChart data={pipeline.filter((p) => p.count > 0)} nameKey="name" valueKey="count" height={260} />
        </motion.div>
      </div>

      {/* Leads & cost by field */}
      {!affiliateView && fields?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6 lg:col-span-2">
            <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-1">Leads by field</h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">How many leads each channel brings, and what they cost.</p>
            <BarsChart data={fields.slice(0, 8)} x="field" bars={[{ key: 'leads', name: 'Leads', color: '#00A8A5' }, { key: 'won', name: 'Won', color: '#3E7C57' }]} />
          </div>
          <div className="card p-6 overflow-hidden">
            <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Cost per lead</h2>
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto -mr-2 pr-2">
              {fields.slice(0, 8).map((f) => (
                <div key={f.field} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-700 dark:text-neutral-200 truncate">{f.field}</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{money(f.costPerLead)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Follow-ups + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl text-neutral-900 dark:text-white">Follow-ups due</h2>
            <span className="chip bg-accent-orange/10 text-accent-orange">Next 48h</span>
          </div>
          {followups.length === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 py-8 text-center">No follow-ups due. 🎉</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto -mr-2 pr-2">
              {followups.map((f) => {
                const overdue = new Date(f.followUpAt) < new Date();
                return (
                  <Link to={`/leads/${f.id}`} key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-200 dark:bg-neutral-700 transition">
                    <Avatar name={f.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{f.name}</div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.stageColor }} />{f.stageName}
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${overdue ? 'text-accent-red' : 'text-neutral-600 dark:text-neutral-400'}`}>{relTime(f.followUpAt)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-6 lg:col-span-2">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Recent activity</h2>
          <div className="space-y-1">
            {recent.map((r, i) => (
              <Link to={`/leads/${r.leadId}`} key={i} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-neutral-200 dark:bg-neutral-700 transition">
                <span className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 grid place-items-center text-sm">{ACT_ICON[r.type] || '•'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-neutral-900 dark:text-white truncate">
                    <span className="font-semibold">{r.who || 'System'}</span> · {r.type} on <span className="font-semibold">{r.leadName}</span>
                  </div>
                  {r.body && <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{r.body}</div>}
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-500 whitespace-nowrap">{relTime(r.when)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
