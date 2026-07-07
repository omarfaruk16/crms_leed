import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { money, relTime, dateLabel } from '../lib/format.js';
import { Avatar, PageLoader, useToast, Confirm } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import LeadForm from '../components/LeadForm.jsx';

const ACT = {
  call: { icon: '📞', label: 'Call', color: '#4A6FA5' },
  email: { icon: '✉', label: 'Email', color: '#6B5B95' },
  whatsapp: { icon: '💬', label: 'WhatsApp', color: '#3E7C57' },
  note: { icon: '📝', label: 'Note', color: '#C0703B' },
  viewing: { icon: '👁', label: 'Viewing', color: '#2F7E7E' },
  stage_change: { icon: '↗', label: 'Stage', color: '#00A8A5' },
  system: { icon: '⚙', label: 'System', color: '#8c8276' },
};

export default function LeadDetail() {
  const { id } = useParams();
  const { can, isType } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const hideAgent = isType('owner');
  const [data, setData] = useState(null);
  const [refs, setRefs] = useState({ stages: [], agents: [], events: [], fields: [], expenses: [] });
  const [type, setType] = useState('note');
  const [draft, setDraft] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const load = () => api.get(`/leads/${id}`).then(setData).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  useEffect(() => {
    Promise.all([api.get('/stages'), api.get('/accounts'), api.get('/events'), api.get('/leads/meta/filters'), api.get('/expenses/options')])
      .then(([s, a, e, f, x]) => setRefs({ stages: s.stages, agents: a.accounts || [], events: e.events, fields: f.fields, expenses: x.options }))
      .catch(() => {});
  }, []);

  if (!data) return <PageLoader />;
  const { lead, activities } = data;
  const canEdit = can('canEditLead') || can('canAddLead');

  const logActivity = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    try {
      await api.post(`/leads/${id}/activities`, { type, body: draft.trim() });
      setDraft(''); load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async () => {
    try { await api.del(`/leads/${id}`); toast.success('Lead deleted'); nav('/leads'); }
    catch (e) { toast.error(e.message); }
  };

  const Field = ({ label, value }) => (
    <div><div className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">{label}</div>
      <div className="text-sm text-neutral-900 dark:text-white mt-0.5">{value || <span className="text-neutral-500 dark:text-neutral-500">—</span>}</div></div>
  );

  return (
    <div className="space-y-5">
      <Link to="/leads" className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:text-primary-500 dark:text-primary-400">← Back to leads</Link>

      {/* Header */}
      <div className="card p-6 flex flex-wrap items-center gap-4">
        <Avatar name={lead.name} url={lead.photoUrl} size={64} />
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-3xl text-neutral-900 dark:text-white">{lead.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="chip text-xs font-semibold" style={{ background: (lead.stageColor || '#999') + '22', color: lead.stageColor }}>{lead.stageName}</span>
            {lead.tags?.map((t) => <span key={t} className="chip bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400">{t}</span>)}
            <span className="text-sm text-neutral-600 dark:text-neutral-400">· {money(lead.budget)} budget</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`tel:${lead.phone}`} className="btn-ghost">📞 Call</a>
          <a href={`mailto:${lead.email}`} className="btn-ghost">✉ Email</a>
          {canEdit && <button className="btn-primary" onClick={() => setEditOpen(true)}>✏ Edit info</button>}
          {can('canDeleteLead') && <button className="btn-danger !px-3" onClick={() => setDelOpen(true)}>🗑</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info */}
        <div className="space-y-5">
          <div className="card p-6 grid grid-cols-2 gap-4">
            <Field label="Phone" value={lead.phone} />
            <Field label="Email" value={lead.email} />
            <div className="col-span-2"><Field label="Address" value={lead.address} /></div>
            {!hideAgent && <Field label="Agent" value={lead.agentName} />}
            <Field label="Field" value={lead.field} />
            <Field label="Source" value={lead.source} />
            <Field label="Campaign" value={lead.eventName} />
            <Field label="Brought by" value={lead.expenseTitle} />
            {!hideAgent && <Field label="Added by" value={lead.addedByName} />}
            <Field label="Created" value={dateLabel(lead.createdAt)} />
            <Field label="Priority" value={lead.priority} />
            <Field label="Next follow-up" value={lead.followUpAt ? relTime(lead.followUpAt) : null} />
          </div>
          <div className="card p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">Lead score</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${lead.score}%`, background: lead.score > 66 ? '#3E7C57' : lead.score > 33 ? '#C0703B' : '#A14B4B' }} />
              </div>
              <span className="font-heading text-2xl text-neutral-900 dark:text-white">{lead.score}</span>
            </div>
          </div>
        </div>

        {/* Conversation */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Conversation history</h2>
          {canEdit && <form onSubmit={logActivity} className="mb-5">
            <div className="flex gap-2 mb-2 flex-wrap">
              {Object.entries(ACT).filter(([k]) => ['call', 'email', 'whatsapp', 'note', 'viewing'].includes(k)).map(([k, v]) => (
                <button type="button" key={k} onClick={() => setType(k)}
                  className={`chip border transition ${type === k ? 'text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700'}`}
                  style={type === k ? { background: v.color, borderColor: v.color } : {}}>{v.icon} {v.label}</button>
              ))}
            </div>
            <textarea className="input min-h-[80px] resize-y" placeholder="Log a call, email, viewing or note…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex justify-end mt-2"><button className="btn-primary" disabled={!draft.trim()}>＋ Add log entry</button></div>
          </form>}

          <div className="space-y-3">
            {activities.length === 0 && <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center py-6">No activity logged yet.</p>}
            {activities.map((a) => {
              const meta = ACT[a.type] || ACT.note;
              return (
                <div key={a.id} className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl grid place-items-center text-sm shrink-0" style={{ background: meta.color + '22' }}>{meta.icon}</div>
                  <div className="flex-1 min-w-0 border-b border-neutral-200 dark:border-neutral-700 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">{meta.label}{a.who ? ` · ${a.who}` : ''}</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-500 whitespace-nowrap">{relTime(a.createdAt)}</span>
                    </div>
                    {a.body && <p className="text-sm text-neutral-700 dark:text-neutral-200 mt-0.5">{a.body}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <LeadForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} lead={lead} refs={refs} />
      <Confirm open={delOpen} title="Delete lead?" danger confirmLabel="Delete"
        message={`This permanently removes ${lead.name} and their activity history.`}
        onConfirm={remove} onClose={() => setDelOpen(false)} />
    </div>
  );
}
