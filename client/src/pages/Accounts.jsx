import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { money, dateLabel } from '../lib/format.js';
import { Avatar, PageLoader, Modal, Spinner, useToast, Confirm, Empty, ImageUpload } from '../components/ui.jsx';

const TABS = [
  { key: 'admin', label: 'Admins' },
  { key: 'employee', label: 'Employees' },
  { key: 'owner', label: 'Owners' },
  { key: 'affiliate', label: 'Affiliate Partners' },
  { key: 'stages', label: 'Pipeline stages' },
  { key: 'roles', label: 'Roles & permissions' },
];

const TYPE_LABEL = { admin: 'Admin', employee: 'Employee', owner: 'Owner', affiliate: 'Affiliate Partner' };

const PERM_LABELS = {
  canAddLead: 'Add leads', canEditLead: 'Edit leads', canDeleteLead: 'Delete leads', canAssignLead: 'Assign & re-stage',
  canImportExport: 'Import / export', canManageEvents: 'Manage events', canManageExpenses: 'Manage expenses',
  canManageStages: 'Manage stages', canManageAccounts: 'Manage accounts', canViewAnalytics: 'View analytics', canSeeAgents: 'See agents',
};

export default function Accounts() {
  const [tab, setTab] = useState('admin');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl text-neutral-900 dark:text-white">Accounts &amp; Settings</h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-0.5">Manage your team, owners, partners, permissions and pipeline.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-neutral-300 dark:border-neutral-700">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition ${tab === t.key ? 'border-primary-500 dark:border-primary-400 text-primary-500 dark:text-primary-400' : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:text-white'}`}>
            {t.label}</button>
        ))}
      </div>
      {['admin', 'employee', 'owner', 'affiliate'].includes(tab) ? <AccountList type={tab} /> : tab === 'stages' ? <Stages /> : <Roles />}
    </div>
  );
}

/* ---------------- Accounts ---------------- */
function AccountList({ type }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState(null);
  const [roles, setRoles] = useState([]);
  const [events, setEvents] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwFor, setPwFor] = useState(null);
  const [delFor, setDelFor] = useState(null);

  const load = () => api.get('/accounts').then((d) => setAccounts(d.accounts)).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
    api.get('/roles').then((d) => setRoles(d.roles)).catch(() => {});
    api.get('/events').then((d) => setEvents(d.events)).catch(() => {});
  }, []); // eslint-disable-line

  if (!accounts) return <PageLoader />;
  const list = accounts.filter((a) => a.accountType === type);
  const isAffiliate = type === 'affiliate';
  const isOwner = type === 'owner';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ Add {TYPE_LABEL[type].toLowerCase()}</button>
      </div>
      {list.length === 0 ? <Empty title="No accounts here yet" hint="Create the first account for this group." /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-center gap-3">
                <Avatar name={a.name} url={a.avatarUrl} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-neutral-900 dark:text-white truncate">{a.name}</div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{a.email}</div>
                </div>
                {!a.isActive && <span className="chip bg-accent-red/10 text-accent-red">Inactive</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                <div><span className="text-neutral-600 dark:text-neutral-400">Role</span><div className="font-semibold text-neutral-900 dark:text-white">{a.roleName || '—'}</div></div>
                <div><span className="text-neutral-600 dark:text-neutral-400">Company</span><div className="font-semibold text-neutral-900 dark:text-white truncate">{a.company || '—'}</div></div>
                {isAffiliate && <div><span className="text-neutral-600 dark:text-neutral-400">Per won lead</span><div className="font-semibold text-accent-green">{money(a.commission)}</div></div>}
                <div><span className="text-neutral-600 dark:text-neutral-400">Last login</span><div className="font-semibold text-neutral-900 dark:text-white">{a.lastLoginAt ? dateLabel(a.lastLoginAt) : 'Never'}</div></div>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="btn-ghost !py-1.5 flex-1 text-xs" onClick={() => { setEditing(a); setFormOpen(true); }}>Edit</button>
                <button className="btn-ghost !py-1.5 flex-1 text-xs" onClick={() => setPwFor(a)}>🔑 Password</button>
                <button className="btn-ghost !py-1.5 !px-2.5 text-xs hover:!text-accent-red" onClick={() => setDelFor(a)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AccountForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} account={editing} defaultType={type} roles={roles} events={events} showEvents={isOwner} />
      <PasswordModal account={pwFor} onClose={() => setPwFor(null)} />
      <Confirm open={!!delFor} title="Deactivate account?" danger confirmLabel="Deactivate"
        message={`${delFor?.name} will no longer be able to sign in. Their leads stay intact.`}
        onConfirm={async () => { try { await api.del(`/accounts/${delFor.id}`); toast.success('Account deactivated'); setDelFor(null); load(); } catch (e) { toast.error(e.message); } }}
        onClose={() => setDelFor(null)} />
    </div>
  );
}

function AccountForm({ open, onClose, onSaved, account, defaultType, roles, events, showEvents }) {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (account) {
      // load linked events for owners
      api.get(`/accounts/detail/${account.id}`).then((d) => setForm((f) => ({ ...f, eventIds: d.eventIds || [] }))).catch(() => {});
      setForm({
        name: account.name, email: account.email, accountType: account.accountType, roleId: account.roleId || '',
        company: account.company || '', phone: account.phone || '', commission: account.commission || '',
        avatarUrl: account.avatarUrl || '', eventIds: [],
      });
    } else {
      setForm({ name: '', email: '', password: '', accountType: defaultType, roleId: roles.find((r) => r.name.toLowerCase().includes(defaultType))?.id || '', company: '', phone: '', commission: '', avatarUrl: '', eventIds: [] });
    }
  }, [open, account, defaultType, roles]); // eslint-disable-line
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleEvent = (id) => setForm((f) => ({ ...f, eventIds: (f.eventIds || []).includes(id) ? f.eventIds.filter((x) => x !== id) : [...(f.eventIds || []), id] }));

  const isOwner = (form.accountType || defaultType) === 'owner';
  const isAffiliate = (form.accountType || defaultType) === 'affiliate';

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (account) await api.put(`/accounts/${account.id}`, form);
      else await api.post('/accounts', form);
      toast.success(account ? 'Account updated' : 'Account created');
      onSaved(); onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={account ? 'Edit account' : 'Create account'} wide
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" form="acct-form" disabled={busy}>{busy ? <Spinner className="w-4 h-4 border-white/40 border-t-white" /> : (account ? 'Save' : 'Create account')}</button></>}>
      <form id="acct-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="label">Profile photo</label>
          <ImageUpload value={form.avatarUrl} onChange={(url) => setForm((f) => ({ ...f, avatarUrl: url }))} label="Upload photo" rounded /></div>
        <div><label className="label">Name</label><input className="input" placeholder="e.g. Olivia Bennett" value={form.name || ''} onChange={set('name')} required /></div>
        <div><label className="label">Email</label><input className="input" type="email" placeholder="email@company.com" value={form.email || ''} onChange={set('email')} required disabled={!!account} /></div>
        {!account && <div className="sm:col-span-2"><label className="label">Password</label><input className="input" type="text" placeholder="Min 4 characters" value={form.password || ''} onChange={set('password')} required /></div>}
        <div><label className="label">Account type</label>
          <select className="input" value={form.accountType || 'employee'} onChange={set('accountType')}>
            <option value="admin">Admin</option><option value="employee">Employee</option><option value="owner">Owner</option><option value="affiliate">Affiliate Partner</option>
          </select></div>
        <div><label className="label">Role</label>
          <select className="input" value={form.roleId || ''} onChange={set('roleId')}>
            <option value="">— No role —</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select></div>
        <div><label className="label">Company</label><input className="input" placeholder="Company name" value={form.company || ''} onChange={set('company')} /></div>
        <div><label className="label">Phone</label><input className="input" placeholder="+1 415-555-0000" value={form.phone || ''} onChange={set('phone')} /></div>
        {isAffiliate && <div className="sm:col-span-2"><label className="label">Commission per won lead ($)</label><input className="input" type="number" placeholder="250" value={form.commission || ''} onChange={set('commission')} /></div>}
        {(isOwner || showEvents) && (
          <div className="sm:col-span-2">
            <label className="label">Linked events (owner can see these)</label>
            {events.length === 0 ? <p className="text-xs text-neutral-500 dark:text-neutral-500">No events yet.</p> : (
              <div className="flex flex-wrap gap-2">
                {events.map((ev) => (
                  <button type="button" key={ev.id} onClick={() => toggleEvent(ev.id)}
                    className={`chip border transition ${(form.eventIds || []).includes(ev.id) ? 'bg-primary-500 dark:bg-primary-600 text-white border-primary-500 dark:border-primary-400' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700'}`}>
                    {ev.name}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

function PasswordModal({ account, onClose }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPw(''); }, [account]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post(`/accounts/${account.id}/password`, { newPassword: pw }); toast.success('Password updated'); onClose(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!account} onClose={onClose} title="Set new password"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" form="pw-form" disabled={busy || pw.length < 4}>{busy ? <Spinner className="w-4 h-4 border-white/40 border-t-white" /> : 'Update password'}</button></>}>
      <p className="text-sm text-neutral-700 dark:text-neutral-200 mb-3">Set a new password for <span className="font-semibold">{account?.name}</span>. They'll use it on next sign-in.</p>
      <form id="pw-form" onSubmit={submit}>
        <label className="label">New password</label>
        <input className="input" type="text" placeholder="Min 4 characters" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </form>
    </Modal>
  );
}

/* ---------------- Pipeline stages ---------------- */
function Stages() {
  const toast = useToast();
  const [stages, setStages] = useState(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2F7E7E');
  const load = () => api.get('/stages').then((d) => setStages(d.stages)).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line
  if (!stages) return <PageLoader />;

  const add = async () => { if (!name.trim()) return; try { await api.post('/stages', { name, color }); setName(''); load(); } catch (e) { toast.error(e.message); } };
  const update = async (s, patch) => { try { await api.put(`/stages/${s.id}`, patch); load(); } catch (e) { toast.error(e.message); } };
  const del = async (s) => { try { await api.del(`/stages/${s.id}`); load(); } catch (e) { toast.error(e.message); } };

  const Flag = ({ s, k, label, color }) => (
    <button onClick={() => update(s, { [k]: !s[k] })}
      className={`chip border transition ${s[k] ? 'text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700'}`}
      style={s[k] ? { background: color, borderColor: color } : {}}>{label}</button>
  );

  return (
    <div className="card p-6 max-w-3xl">
      <h2 className="font-heading text-xl text-neutral-900 dark:text-white mb-1">Pipeline stages</h2>
      <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">Rename, recolour, reorder and flag stages. <b>Won</b> counts as a closed deal; <b>Min affiliate</b> is the earliest stage affiliate partners may use.</p>
      <div className="space-y-2">
        {stages.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-2.5">
            <input type="color" value={s.color} onChange={(e) => update(s, { color: e.target.value })} className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent" />
            <input className="input !py-1.5 flex-1 min-w-[140px]" defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && update(s, { name: e.target.value })} />
            <Flag s={s} k="isWon" label="Won" color="#3E7C57" />
            <Flag s={s} k="isLost" label="Lost" color="#A14B4B" />
            <Flag s={s} k="isAffiliateMin" label="Min affiliate" color="#6B5B95" />
            <button onClick={() => del(s)} className="text-neutral-500 dark:text-neutral-500 hover:text-accent-red px-2">×</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-300 dark:border-neutral-700">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent" />
        <input className="input !py-2 flex-1" placeholder="New stage name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn-primary" onClick={add}>+ Add stage</button>
      </div>
    </div>
  );
}

/* ---------------- Roles & permissions ---------------- */
function Roles() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const load = () => api.get('/roles').then(setData).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line
  if (!data) return <PageLoader />;

  const del = async (r) => { try { await api.del(`/roles/${r.id}`); load(); } catch (e) { toast.error(e.message); } };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}>＋ Add custom role</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.roles.map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-heading text-xl text-neutral-900 dark:text-white flex items-center gap-2">{r.name}
                  {r.isSystem && <span className="chip bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 text-[10px]">System</span>}</div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">{r.memberCount} member{r.memberCount !== 1 ? 's' : ''}</div>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost !py-1 !px-2.5 text-xs" onClick={() => { setEditing(r); setOpen(true); }}>Edit</button>
                {!r.isSystem && <button className="btn-ghost !py-1 !px-2.5 text-xs hover:!text-accent-red" onClick={() => del(r)}>🗑</button>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {data.permissionKeys.filter((k) => r.permissions[k]).map((k) => (
                <span key={k} className="chip bg-primary-500 dark:bg-primary-600/10 text-primary-500 dark:text-primary-400 text-[11px]">{PERM_LABELS[k] || k}</span>
              ))}
              {data.permissionKeys.filter((k) => r.permissions[k]).length === 0 && <span className="text-xs text-neutral-500 dark:text-neutral-500">No permissions</span>}
            </div>
          </div>
        ))}
      </div>
      <RoleForm open={open} onClose={() => setOpen(false)} onSaved={load} role={editing} permKeys={data.permissionKeys} />
    </div>
  );
}

function RoleForm({ open, onClose, onSaved, role, permKeys }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [perms, setPerms] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(role?.name || ''); setDesc(role?.description || '');
    setPerms(role ? permKeys.filter((k) => role.permissions[k]) : []);
  }, [open, role, permKeys]);
  const toggle = (k) => setPerms((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { name, description: desc, permissions: perms };
      if (role) await api.put(`/roles/${role.id}`, body); else await api.post('/roles', body);
      toast.success(role ? 'Role updated' : 'Role created'); onSaved(); onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={role ? 'Edit role' : 'Create custom role'}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" form="role-form" disabled={busy}>{busy ? <Spinner className="w-4 h-4 border-white/40 border-t-white" /> : (role ? 'Save' : 'Create role')}</button></>}>
      <form id="role-form" onSubmit={submit} className="space-y-4">
        <div><label className="label">Role name</label><input className="input" placeholder="e.g. Lead Coordinator" value={name} onChange={(e) => setName(e.target.value)} required disabled={role?.isSystem} /></div>
        <div><label className="label">Description</label><input className="input" placeholder="What this role can do" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div>
          <label className="label">Permissions</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {permKeys.map((k) => (
              <label key={k} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition ${perms.includes(k) ? 'border-primary-500 dark:border-primary-400 bg-primary-500 dark:bg-primary-600/5' : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800'}`}>
                <input type="checkbox" checked={perms.includes(k)} onChange={() => toggle(k)} />
                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{PERM_LABELS[k] || k}</span>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
