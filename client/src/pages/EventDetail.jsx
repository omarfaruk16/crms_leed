import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { money, dateLabel } from '../lib/format.js';
import { PageLoader, Avatar, Modal, Spinner, useToast } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { EventForm } from './Events.jsx';

export default function EventDetail() {
  const { id } = useParams();
  const { can, isType } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const hideOwners = isType('owner');

  const load = () => api.get(`/events/${id}`).then(setData).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (!data) return <PageLoader />;
  const { event, owners, expenses, pipeline } = data;
  const maxPipe = Math.max(1, ...pipeline.map((p) => p.count));
  const target = event.leadTarget || 0;
  const pct = target ? Math.min(100, Math.round((event.wonCount / target) * 100)) : 0;

  const delExpense = async (eid) => { try { await api.del(`/expenses/${eid}`); load(); } catch (e) { toast.error(e.message); } };

  return (
    <div className="space-y-5">
      <Link to="/events" className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:text-primary-500 dark:text-primary-400">← All events</Link>

      <div className="card overflow-hidden">
        <div className="h-40 bg-gradient-to-br from-teal/80 to-[#0f4f4d] relative flex items-end p-6">
          {event.coverUrl && <img src={event.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
          <div className="relative flex items-end justify-between w-full">
            <div>
              <h1 className="font-heading text-4xl text-white drop-shadow">{event.name}</h1>
              <p className="text-white/80 text-sm mt-1">📍 {event.location || '—'} · {dateLabel(event.eventDate)}</p>
            </div>
            {can('canManageEvents') && <button className="btn-ghost !bg-white/90" onClick={() => setEditOpen(true)}>✏ Edit event</button>}
          </div>
        </div>
        <div className="p-6">
          {event.description && <p className="text-neutral-700 dark:text-neutral-200 mb-4">{event.description}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[['Leads', event.leadCount, '#00A8A5'], ['Won', event.wonCount, '#3E7C57'], ['Target', target, '#4A6FA5'], ['Spend', money(event.spend, true), '#C0703B']].map(([l, v, c]) => (
              <div key={l} className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 text-center">
                <div className="font-heading text-2xl" style={{ color: c }}>{v}</div>
                <div className="text-[11px] uppercase text-neutral-600 dark:text-neutral-400 font-semibold">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400 mb-1"><span>Successful lead target progress</span><span>{pct}%</span></div>
            <div className="h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden"><div className="h-full bg-primary-500 dark:bg-primary-600 rounded-full" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-4">Pipeline breakdown</h2>
          <div className="space-y-3">
            {pipeline.map((p) => (
              <div key={p.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />{p.name}</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{p.count}</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(p.count / maxPipe) * 100}%`, background: p.color }} /></div>
              </div>
            ))}
          </div>
          {!hideOwners && (
            <div className="mt-6 pt-5 border-t border-neutral-300 dark:border-neutral-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 mb-2">Owners</div>
              <div className="flex flex-wrap gap-2">
                {owners.length === 0 && <span className="text-sm text-neutral-500 dark:text-neutral-500">No owners linked</span>}
                {owners.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-full pr-3 pl-1 py-1">
                    <Avatar name={o.name} url={o.avatarUrl} size={26} /><span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{o.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl text-neutral-900 dark:text-white">Event expenses</h2>
            {can('canManageExpenses') && <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => setExpOpen(true)}>＋ Add</button>}
          </div>
          {expenses.length === 0 ? <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center py-6">No expenses yet — add your first.</p> : (
            <div className="space-y-2">
              {expenses.map((x) => (
                <div key={x.id} className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700 last:border-0 group">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{x.title}{x.field && <span className="chip bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 text-[10px] ml-1.5">{x.field}</span>}</div>
                    {(x.periodFrom || x.description) && <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{x.description || `${dateLabel(x.periodFrom)} – ${dateLabel(x.periodTo)}`}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">{money(x.amount, true)}</span>
                    {can('canManageExpenses') && <button onClick={() => delExpense(x.id)} className="text-neutral-500 dark:text-neutral-500 hover:text-accent-red opacity-0 group-hover:opacity-100 transition">×</button>}
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 font-bold text-neutral-900 dark:text-white"><span>Total</span><span>{money(event.spend)}</span></div>
            </div>
          )}
        </div>
      </div>

      <EventForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} event={{ ...event, ownerIds: owners.map((o) => o.id) }} />
      <ExpenseModal open={expOpen} onClose={() => setExpOpen(false)} eventId={id} defaultField={event.name} onSaved={load} />
    </div>
  );
}

function ExpenseModal({ open, onClose, eventId, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', description: '', field: '', amount: '', periodFrom: '', periodTo: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm({ title: '', description: '', field: '', amount: '', periodFrom: '', periodTo: '' }); }, [open]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/expenses', { ...form, eventId }); toast.success('Expense added'); onSaved(); onClose(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add expense"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" form="exp-form" disabled={busy}>{busy ? <Spinner className="w-4 h-4 border-white/40 border-t-white" /> : 'Save expense'}</button></>}>
      <form id="exp-form" onSubmit={submit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="label">Title</label><input className="input" placeholder="Ad spend" value={form.title} onChange={set('title')} required /></div>
        <div className="col-span-2"><label className="label">Description (optional)</label><input className="input" placeholder="Brief note" value={form.description} onChange={set('description')} /></div>
        <div><label className="label">Field</label><input className="input" placeholder="Google Ads" value={form.field} onChange={set('field')} /></div>
        <div><label className="label">Amount ($)</label><input className="input" type="number" placeholder="5000" value={form.amount} onChange={set('amount')} required /></div>
        <div><label className="label">From</label><input className="input" type="date" value={form.periodFrom} onChange={set('periodFrom')} /></div>
        <div><label className="label">To</label><input className="input" type="date" value={form.periodTo} onChange={set('periodTo')} /></div>
      </form>
    </Modal>
  );
}
