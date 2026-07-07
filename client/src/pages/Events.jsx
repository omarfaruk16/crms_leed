import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { money, dateLabel } from '../lib/format.js';
import { PageLoader, Empty, Modal, Spinner, useToast, ImageUpload } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Events() {
  const { can } = useAuth();
  const toast = useToast();
  const [events, setEvents] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => api.get('/events').then((d) => setEvents(d.events)).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line

  if (!events) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl text-neutral-900 dark:text-white">Events &amp; Campaigns</h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-0.5">{events.length} campaigns generating leads</p>
        </div>
        {can('canManageEvents') && <button className="btn-primary" onClick={() => setOpen(true)}>＋ Create event</button>}
      </div>

      {events.length === 0 ? <Empty title="No events yet" hint="Create your first campaign to start tracking lead ROI." /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((e) => {
            const target = e.leadTarget || 0;
            const pct = target ? Math.min(100, Math.round((e.wonCount / target) * 100)) : 0;
            return (
              <Link to={`/events/${e.id}`} key={e.id} className="card overflow-hidden hover:shadow-lift transition group">
                <div className="h-28 bg-gradient-to-br from-teal/80 to-[#0f4f4d] relative flex items-end p-4">
                  {e.coverUrl && <img src={e.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
                  <h3 className="relative font-heading text-2xl text-white drop-shadow">{e.name}</h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <span>📍 {e.location || '—'}</span><span>·</span><span>{dateLabel(e.eventDate)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className="font-heading text-xl text-neutral-900 dark:text-white">{e.leadCount}</div><div className="text-[10px] uppercase text-neutral-600 dark:text-neutral-400 font-semibold">Leads</div></div>
                    <div><div className="font-heading text-xl text-accent-green">{e.wonCount}</div><div className="text-[10px] uppercase text-neutral-600 dark:text-neutral-400 font-semibold">Won</div></div>
                    <div><div className="font-heading text-xl text-accent-orange">{money(e.spend, true)}</div><div className="text-[10px] uppercase text-neutral-600 dark:text-neutral-400 font-semibold">Spend</div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-600 dark:text-neutral-400 mb-1"><span>Won target {target}</span><span>{pct}%</span></div>
                    <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden"><div className="h-full bg-primary-500 dark:bg-primary-600 rounded-full" style={{ width: `${pct}%` }} /></div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <EventForm open={open} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  );
}

export function EventForm({ open, onClose, onSaved, event }) {
  const toast = useToast();
  const [owners, setOwners] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', location: '', eventDate: '', leadTarget: '', coverUrl: '', ownerIds: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get('/accounts').then((d) => setOwners((d.accounts || []).filter((a) => a.accountType === 'owner'))).catch(() => {});
    if (event) setForm({
      name: event.name, description: event.description || '', location: event.location || '',
      eventDate: event.eventDate ? event.eventDate.slice(0, 10) : '', leadTarget: event.leadTarget || '',
      coverUrl: event.coverUrl || '', ownerIds: event.ownerIds || [],
    });
    else setForm({ name: '', description: '', location: '', eventDate: '', leadTarget: '', coverUrl: '', ownerIds: [] });
  }, [open, event]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleOwner = (id) => setForm((f) => ({ ...f, ownerIds: f.ownerIds.includes(id) ? f.ownerIds.filter((x) => x !== id) : [...f.ownerIds, id] }));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (event) await api.put(`/events/${event.id}`, form);
      else await api.post('/events', form);
      toast.success(event ? 'Event updated' : 'Event created');
      onSaved?.(); onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={event ? 'Edit event' : 'Create event'} wide
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" form="event-form" disabled={busy}>{busy ? <Spinner className="w-4 h-4 border-white/40 border-t-white" /> : (event ? 'Save' : 'Create event')}</button></>}>
      <form id="event-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="label">Cover image</label>
          <ImageUpload value={form.coverUrl} onChange={(url) => setForm((f) => ({ ...f, coverUrl: url }))} label="Upload cover" /></div>
        <div className="sm:col-span-2"><label className="label">Event name</label><input className="input" placeholder="e.g. Summer Showcase" value={form.name} onChange={set('name')} required /></div>
        <div className="sm:col-span-2"><label className="label">Description</label><input className="input" placeholder="Brief overview" value={form.description} onChange={set('description')} /></div>
        <div><label className="label">Location</label><input className="input" placeholder="Venue / City" value={form.location} onChange={set('location')} /></div>
        <div><label className="label">Date</label><input className="input" type="date" value={form.eventDate} onChange={set('eventDate')} /></div>
        <div><label className="label">Successful lead target</label><input className="input" type="number" placeholder="120" value={form.leadTarget} onChange={set('leadTarget')} /></div>
        <div className="sm:col-span-2">
          <label className="label">Linked owners</label>
          {owners.length === 0 ? <p className="text-xs text-neutral-500 dark:text-neutral-500">No owner accounts yet — create one in Accounts.</p> : (
            <div className="flex flex-wrap gap-2">
              {owners.map((o) => (
                <button type="button" key={o.id} onClick={() => toggleOwner(o.id)}
                  className={`chip border transition ${form.ownerIds.includes(o.id) ? 'bg-primary-500 dark:bg-primary-600 text-white border-primary-500 dark:border-primary-400' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700'}`}>
                  {o.name}</button>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
