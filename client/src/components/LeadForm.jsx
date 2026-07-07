import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Modal, Spinner, useToast, ImageUpload } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const blank = { name: '', phone: '', email: '', address: '', budget: '', field: '', source: '',
  score: 25, priority: 'medium', tags: '', photoUrl: '', stageId: '', agentId: '', eventId: '', expenseId: '', followUpAt: '' };

// datetime-local needs "YYYY-MM-DDTHH:mm"
const toLocal = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

export default function LeadForm({ open, onClose, onSaved, lead, refs }) {
  const toast = useToast();
  const { isType, isAdmin } = useAuth();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const affiliate = isType('affiliate') && !isAdmin;

  // affiliates may only choose qualified-or-later stages
  const affiliateMinPos = (refs.stages || []).find((s) => s.isAffiliateMin)?.position ?? 0;
  const stageOptions = affiliate ? (refs.stages || []).filter((s) => s.position >= affiliateMinPos) : (refs.stages || []);

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        name: lead.name, phone: lead.phone || '', email: lead.email || '', address: lead.address || '',
        budget: lead.budget || '', field: lead.field || '', source: lead.source || '',
        score: lead.score ?? 25, priority: lead.priority || 'medium', tags: (lead.tags || []).join(', '),
        photoUrl: lead.photoUrl || '', stageId: lead.stageId || '', agentId: lead.agentId || '',
        eventId: lead.eventId || '', expenseId: lead.expenseId || '', followUpAt: toLocal(lead.followUpAt),
      });
    } else {
      setForm({ ...blank, stageId: (affiliate ? stageOptions[0]?.id : refs.stages?.[0]?.id) || '' });
    }
  }, [open, lead, refs.stages]); // eslint-disable-line

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // When an expense is chosen, default the lead's field to that expense's field.
  const onExpense = (e) => {
    const id = e.target.value;
    const exp = (refs.expenses || []).find((x) => x.id === id);
    setForm((f) => ({ ...f, expenseId: id, field: !f.field && exp ? exp.field : f.field }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        followUpAt: form.followUpAt ? new Date(form.followUpAt).toISOString() : null };
      if (lead) await api.put(`/leads/${lead.id}`, payload);
      else await api.post('/leads', payload);
      toast.success(lead ? 'Lead updated' : 'Lead added');
      onSaved?.();
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={lead ? 'Edit lead' : 'Add new lead'} wide
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" form="lead-form" disabled={busy}>{busy ? <Spinner className="w-4 h-4 border-white/40 border-t-white" /> : (lead ? 'Save changes' : 'Add lead')}</button>
      </>}>
      <form id="lead-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 flex items-center gap-4">
          <ImageUpload value={form.photoUrl} onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))} label="Lead photo" rounded />
          <div className="flex-1"><label className="label">Full name</label>
            <input className="input" placeholder="e.g. Olivia Bennett" value={form.name} onChange={set('name')} required /></div>
        </div>
        <div><label className="label">Phone</label><input className="input" placeholder="+1 415-555-0000" value={form.phone} onChange={set('phone')} /></div>
        <div><label className="label">Email</label><input className="input" type="email" placeholder="name@email.com" value={form.email} onChange={set('email')} /></div>
        <div className="sm:col-span-2"><label className="label">Address</label><input className="input" placeholder="Street, area" value={form.address} onChange={set('address')} /></div>
        <div><label className="label">Budget ($)</label><input className="input" type="number" placeholder="2400000" value={form.budget} onChange={set('budget')} /></div>
        <div><label className="label">Lead score</label><input className="input" type="number" min="0" max="100" value={form.score} onChange={set('score')} /></div>
        <div><label className="label">Field (channel)</label><input className="input" placeholder="Google Ads" value={form.field} onChange={set('field')} list="fields" />
          <datalist id="fields">{(refs.fields || []).map((c) => <option key={c} value={c} />)}</datalist></div>
        <div><label className="label">Source</label><input className="input" placeholder="Website form" value={form.source} onChange={set('source')} /></div>
        <div><label className="label">Which expense brought this lead</label>
          <select className="input" value={form.expenseId} onChange={onExpense}>
            <option value="">— None —</option>
            {(refs.expenses || []).map((x) => <option key={x.id} value={x.id}>{x.title}{x.field ? ` · ${x.field}` : ''}</option>)}
          </select></div>
        <div><label className="label">Stage</label>
          <select className="input" value={form.stageId} onChange={set('stageId')}>
            {stageOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        {!affiliate && <div><label className="label">Assign agent</label>
          <select className="input" value={form.agentId} onChange={set('agentId')}>
            <option value="">— Unassigned —</option>
            {(refs.agents || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>}
        <div><label className="label">Campaign / event</label>
          <select className="input" value={form.eventId} onChange={set('eventId')}>
            <option value="">— No event —</option>
            {(refs.events || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select></div>
        <div><label className="label">Priority</label>
          <select className="input" value={form.priority} onChange={set('priority')}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select></div>
        <div><label className="label">Next follow-up</label><input className="input" type="datetime-local" value={form.followUpAt} onChange={set('followUpAt')} /></div>
        <div className="sm:col-span-2"><label className="label">Tags (comma separated)</label><input className="input" placeholder="VIP, Cash buyer" value={form.tags} onChange={set('tags')} /></div>
        {affiliate && <p className="sm:col-span-2 text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 py-2">As an affiliate partner, leads start at <b>Qualified</b> or later and you earn a commission on each won lead.</p>}
      </form>
    </Modal>
  );
}
