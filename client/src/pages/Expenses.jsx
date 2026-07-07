import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { money, dateLabel } from '../lib/format.js';
import { PageLoader, Empty, Modal, Spinner, useToast, Confirm } from '../components/ui.jsx';
import { DonutChart, BarsChart } from '../components/charts.jsx';

export default function Expenses() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [fields, setFields] = useState([]);
  const [filters, setFilters] = useState({ search: '', field: '', event: '', from: '', to: '' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [delFor, setDelFor] = useState(null);

  const qs = () => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  };
  const load = () => api.get(`/expenses?${qs()}`).then(setData).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, [filters]); // eslint-disable-line
  useEffect(() => {
    api.get('/events').then((d) => setEvents(d.events)).catch(() => {});
    api.get('/expenses/fields').then((d) => setFields(d.fields)).catch(() => {});
  }, []);

  if (!data) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl text-neutral-900 dark:text-white">Expenses</h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-0.5">{data.expenses.length} entries · {money(data.totalSpend)} total spend</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ Add expense</button>
      </div>

      {/* Spend summary charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-6">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-3">Spend by field</h2>
          {data.byField.length ? <DonutChart data={data.byField} nameKey="field" valueKey="amount" fmt={(v) => money(v, true)} /> : <Empty title="No spend yet" />}
        </div>
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-3">Spend by title</h2>
          {data.byTitle.length ? <BarsChart data={data.byTitle.slice(0, 8)} x="title" bars={[{ key: 'amount', name: 'Spend', color: '#C0703B' }]} fmt={(v) => money(v, true)} /> : <Empty title="No spend yet" />}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <input className="input !w-auto flex-1 min-w-[160px]" placeholder="Search title…" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        <select className="input !w-auto" value={filters.field} onChange={(e) => setFilters((f) => ({ ...f, field: e.target.value }))}>
          <option value="">All fields</option>{fields.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input !w-auto" value={filters.event} onChange={(e) => setFilters((f) => ({ ...f, event: e.target.value }))}>
          <option value="">All events</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">From <input type="date" className="input !w-auto !py-2" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} /></div>
        <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">To <input type="date" className="input !w-auto !py-2" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} /></div>
      </div>

      {/* Table */}
      {data.expenses.length === 0 ? <Empty title="No expenses found" hint="Add your first expense to start tracking spend and cost-per-lead." /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800">
                <th className="px-4 py-3">Title</th><th className="px-4 py-3">Field</th><th className="px-4 py-3 hidden md:table-cell">Period</th>
                <th className="px-4 py-3 hidden lg:table-cell">Event</th><th className="px-4 py-3">Leads</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3 w-20"></th></tr></thead>
              <tbody>
                {data.expenses.map((x) => (
                  <tr key={x.id} className="border-b border-neutral-200 dark:border-neutral-700 last:border-0 hover:bg-neutral-100 dark:bg-neutral-800 transition">
                    <td className="px-4 py-3"><div className="font-semibold text-neutral-900 dark:text-white">{x.title}</div>{x.description && <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate max-w-xs">{x.description}</div>}</td>
                    <td className="px-4 py-3"><span className="chip bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200">{x.field || '—'}</span></td>
                    <td className="px-4 py-3 hidden md:table-cell text-neutral-600 dark:text-neutral-400 text-xs">{x.periodFrom ? `${dateLabel(x.periodFrom)} – ${dateLabel(x.periodTo)}` : '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-neutral-700 dark:text-neutral-200">{x.eventName || '—'}</td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-200">{x.leadCount ?? 0}{x.wonCount ? <span className="text-accent-green"> · {x.wonCount} won</span> : ''}</td>
                    <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white">{money(x.amount, true)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="text-neutral-500 dark:text-neutral-500 hover:text-primary-500 dark:text-primary-400 px-1" onClick={() => { setEditing(x); setFormOpen(true); }}>✏</button>
                        <button className="text-neutral-500 dark:text-neutral-500 hover:text-accent-red px-1" onClick={() => setDelFor(x)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ExpenseForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} expense={editing} events={events} fields={fields} />
      <Confirm open={!!delFor} title="Delete expense?" danger confirmLabel="Delete"
        message={`Remove "${delFor?.title}" (${money(delFor?.amount)})? Leads attributed to it keep their field.`}
        onConfirm={async () => { try { await api.del(`/expenses/${delFor.id}`); toast.success('Expense deleted'); setDelFor(null); load(); } catch (e) { toast.error(e.message); } }}
        onClose={() => setDelFor(null)} />
    </div>
  );
}

function ExpenseForm({ open, onClose, onSaved, expense, events, fields }) {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setForm(expense ? {
      title: expense.title, description: expense.description || '', field: expense.field || '',
      amount: expense.amount || '', periodFrom: expense.periodFrom?.slice(0, 10) || '',
      periodTo: expense.periodTo?.slice(0, 10) || '', eventId: expense.eventId || '',
    } : { title: '', description: '', field: '', amount: '', periodFrom: '', periodTo: '', eventId: '' });
  }, [open, expense]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (expense) await api.put(`/expenses/${expense.id}`, form);
      else await api.post('/expenses', form);
      toast.success(expense ? 'Expense updated' : 'Expense added');
      onSaved(); onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={expense ? 'Edit expense' : 'Add expense'} wide
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" form="exp-form" disabled={busy}>{busy ? <Spinner className="w-4 h-4 border-white/40 border-t-white" /> : (expense ? 'Save' : 'Add expense')}</button></>}>
      <form id="exp-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="label">Title</label><input className="input" placeholder="e.g. Google Search Ads" value={form.title || ''} onChange={set('title')} required /></div>
        <div className="sm:col-span-2"><label className="label">Description (optional)</label><input className="input" placeholder="Brief note" value={form.description || ''} onChange={set('description')} /></div>
        <div><label className="label">Field</label><input className="input" placeholder="Google Ads" value={form.field || ''} onChange={set('field')} list="exp-fields" />
          <datalist id="exp-fields">{fields.map((c) => <option key={c} value={c} />)}</datalist></div>
        <div><label className="label">Amount ($)</label><input className="input" type="number" placeholder="5000" value={form.amount || ''} onChange={set('amount')} required /></div>
        <div><label className="label">Period from</label><input className="input" type="date" value={form.periodFrom || ''} onChange={set('periodFrom')} /></div>
        <div><label className="label">Period to</label><input className="input" type="date" value={form.periodTo || ''} onChange={set('periodTo')} /></div>
        <div className="sm:col-span-2"><label className="label">Linked event (optional)</label>
          <select className="input" value={form.eventId || ''} onChange={set('eventId')}>
            <option value="">— None —</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select></div>
      </form>
    </Modal>
  );
}
