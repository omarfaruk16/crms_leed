import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { money, relTime } from '../lib/format.js';
import { Avatar, PageLoader, Empty, useToast, Modal, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import LeadForm from '../components/LeadForm.jsx';

const PRIORITY = { high: 'bg-accent-red/10 text-accent-red', medium: 'bg-accent-orange/10 text-accent-orange', low: 'bg-ink-500/10 text-neutral-600 dark:text-neutral-400' };

export default function Leads() {
  const { can, isType } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const hideAgent = isType('owner');

  const [view, setView] = useState('table');
  const [filters, setFilters] = useState({ search: '', stage: '', agent: '', field: '', event: '', expense: '', priority: '', tag: '', sort: 'followup' });
  const [refs, setRefs] = useState({ stages: [], agents: [], events: [], fields: [], tags: [], expenses: [] });
  const [data, setData] = useState(null);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const debounce = useRef();

  // Load reference data once
  useEffect(() => {
    (async () => {
      const [s, a, e, f, x] = await Promise.all([
        api.get('/stages'), api.get('/accounts'), api.get('/events'),
        api.get('/leads/meta/filters'), api.get('/expenses/options'),
      ]);
      setRefs({ stages: s.stages, agents: a.accounts || [], events: e.events, fields: f.fields, tags: f.tags, expenses: x.options });
    })().catch(() => {});
  }, []);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === 'board') setBoard((await api.get(`/leads/board?${qs()}`)).columns);
      else setData(await api.get(`/leads?${qs()}&limit=200`));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [view, qs]); // eslint-disable-line

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(load, 220);
    return () => clearTimeout(debounce.current);
  }, [load]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());

  const bulk = async (action, value) => {
    try {
      await api.post('/leads/bulk', { ids: [...selected], action, value });
      toast.success(`${selected.size} lead(s) updated`);
      clearSel(); load();
    } catch (e) { toast.error(e.message); }
  };

  const exportCsv = async () => {
    const res = await api.raw(`/leads/export/csv?${qs()}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sky-root-leads.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const moveStage = async (id, stageId) => {
    try { await api.patch(`/leads/${id}/stage`, { stageId }); load(); }
    catch (e) { toast.error(e.message); }
  };

  const canMove = can('canAssignLead') || can('canEditLead') || can('canAddLead');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl text-neutral-900 dark:text-white">Leads</h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-0.5">{data?.total ?? board?.reduce((n, c) => n + c.leads.length, 0) ?? 0} leads in your pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 p-1">
            {['table', 'board'].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition ${view === v ? 'bg-primary-500 dark:bg-primary-600 text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:text-white'}`}>{v}</button>
            ))}
          </div>
          {can('canImportExport') && <>
            <button className="btn-ghost" onClick={() => setImportOpen(true)}>↓ Import</button>
            <button className="btn-ghost" onClick={exportCsv}>↑ Export</button>
          </>}
          {can('canAddLead') && <button className="btn-primary" onClick={() => setFormOpen(true)}>＋ Add Lead</button>}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <input className="input !w-auto flex-1 min-w-[180px]" placeholder="Search leads…" value={filters.search} onChange={(e) => setF('search', e.target.value)} />
        <select className="input !w-auto" value={filters.stage} onChange={(e) => setF('stage', e.target.value)}>
          <option value="">All stages</option>{refs.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {!hideAgent && <select className="input !w-auto" value={filters.agent} onChange={(e) => setF('agent', e.target.value)}>
          <option value="">All agents</option>{refs.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>}
        <select className="input !w-auto" value={filters.field} onChange={(e) => setF('field', e.target.value)}>
          <option value="">All fields</option>{refs.fields.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input !w-auto" value={filters.event} onChange={(e) => setF('event', e.target.value)}>
          <option value="">All events</option>{refs.events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="input !w-auto" value={filters.expense} onChange={(e) => setF('expense', e.target.value)}>
          <option value="">All expenses</option>{refs.expenses.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
        </select>
        <select className="input !w-auto" value={filters.tag} onChange={(e) => setF('tag', e.target.value)}>
          <option value="">All tags</option>{refs.tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input !w-auto" value={filters.priority} onChange={(e) => setF('priority', e.target.value)}>
          <option value="">Any priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <select className="input !w-auto" value={filters.sort} onChange={(e) => setF('sort', e.target.value)}>
          <option value="followup">Sort: Follow-up</option><option value="name">Sort: Name</option>
          <option value="score">Sort: Score</option><option value="stage">Sort: Stage</option><option value="created">Sort: Created</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-2 bg-primary-500 dark:bg-primary-600/5 border-primary-500 dark:border-primary-400/30 animate-pop">
          <span className="font-bold text-sm text-primary-500 dark:text-primary-400 px-1">{selected.size} selected</span>
          {canMove && <select className="input !w-auto" defaultValue="" onChange={(e) => { e.target.value && bulk('stage', e.target.value); e.target.value = ''; }}>
            <option value="">Set stage…</option>{refs.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>}
          {can('canAssignLead') && <select className="input !w-auto" defaultValue="" onChange={(e) => { bulk('assign', e.target.value); e.target.value = ''; }}>
            <option value="">Assign to…</option><option value="">Unassign</option>{refs.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>}
          {(can('canEditLead') || can('canAddLead')) && <input className="input !w-auto" placeholder="Add tag…" onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) { bulk('tag', e.target.value); e.target.value = ''; } }} />}
          {can('canDeleteLead') && <button className="btn-danger !py-1.5" onClick={() => bulk('delete')}>Delete</button>}
          <button className="btn-ghost !py-1.5 ml-auto" onClick={clearSel}>Clear</button>
        </div>
      )}

      {/* Body */}
      {loading && !data && !board ? <PageLoader /> :
        view === 'table' ? (
          <TableView data={data} selected={selected} toggleSel={toggleSel} nav={nav} refs={refs} moveStage={moveStage} hideAgent={hideAgent} canMove={canMove} />
        ) : (
          <BoardView board={board} nav={nav} moveStage={moveStage} canMove={canMove} hideAgent={hideAgent} />
        )}

      <LeadForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} refs={refs} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
    </div>
  );
}

/* ---------------- Table ---------------- */
function TableView({ data, selected, toggleSel, nav, refs, moveStage, hideAgent, canMove }) {
  if (!data || data.leads.length === 0) return <Empty title="No leads found" hint="Try adjusting your filters, or add a new lead." />;
  const allSel = data.leads.every((l) => selected.has(l.id));
  const toggleAll = () => data.leads.forEach((l) => { if (allSel) toggleSel(l.id); else if (!selected.has(l.id)) toggleSel(l.id); });
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800">
              <th className="px-4 py-3 w-10"><input type="checkbox" checked={allSel} onChange={toggleAll} /></th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3 hidden md:table-cell">Budget</th>
              {!hideAgent && <th className="px-4 py-3 hidden lg:table-cell">Agent</th>}
              <th className="px-4 py-3 hidden lg:table-cell">Field</th>
              <th className="px-4 py-3">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {data.leads.map((l) => (
              <tr key={l.id} className="border-b border-neutral-200 dark:border-neutral-700 last:border-0 hover:bg-neutral-100 dark:bg-neutral-800 transition cursor-pointer"
                onClick={() => nav(`/leads/${l.id}`)}>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSel(l.id)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={l.name} url={l.photoUrl} size={36} />
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">{l.name}
                        {l.tags?.[0] && <span className="chip bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 text-[10px]">{l.tags[0]}</span>}</div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{l.email || l.phone || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {canMove ? (
                    <select value={l.stageId || ''} onChange={(e) => moveStage(l.id, e.target.value)}
                      className="text-xs font-semibold rounded-lg px-2 py-1 border-0 cursor-pointer"
                      style={{ background: (l.stageColor || '#999') + '22', color: l.stageColor || '#666' }}>
                      {refs.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ) : (
                    <span className="chip text-xs" style={{ background: (l.stageColor || '#999') + '22', color: l.stageColor }}>{l.stageName}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${l.score}%`, background: l.score > 66 ? '#3E7C57' : l.score > 33 ? '#C0703B' : '#A14B4B' }} />
                    </div>
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">{l.score}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell font-semibold text-neutral-700 dark:text-neutral-200">{money(l.budget, true)}</td>
                {!hideAgent && <td className="px-4 py-3 hidden lg:table-cell text-neutral-700 dark:text-neutral-200">{l.agentName || <span className="text-neutral-500 dark:text-neutral-500">Unassigned</span>}</td>}
                <td className="px-4 py-3 hidden lg:table-cell text-neutral-600 dark:text-neutral-400">{l.field || '—'}</td>
                <td className="px-4 py-3">
                  {l.followUpAt ? <span className={`text-xs font-bold ${new Date(l.followUpAt) < new Date() ? 'text-accent-red' : 'text-neutral-700 dark:text-neutral-200'}`}>{relTime(l.followUpAt)}</span> : <span className="text-neutral-500 dark:text-neutral-500 text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Board ---------------- */
function BoardView({ board, nav, moveStage, canMove, hideAgent }) {
  const [drag, setDrag] = useState(null);
  if (!board) return <PageLoader />;
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {board.map((col) => (
        <div key={col.id} className="w-72 shrink-0"
          onDragOver={(e) => canMove && e.preventDefault()}
          onDrop={() => { if (canMove && drag) { moveStage(drag, col.id); setDrag(null); } }}>
          <div className="flex items-center justify-between px-1 mb-3">
            <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />{col.name}
            </div>
            <span className="chip bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400">{col.leads.length}</span>
          </div>
          <div className="space-y-2 min-h-[120px]">
            {col.leads.map((l) => (
              <div key={l.id} draggable={canMove} onDragStart={() => setDrag(l.id)}
                onClick={() => nav(`/leads/${l.id}`)}
                className="card p-3 cursor-pointer hover:shadow-lift transition active:scale-[.99]">
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar name={l.name} url={l.photoUrl} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-neutral-900 dark:text-white truncate">{l.name}</div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{money(l.budget, true)}</div>
                  </div>
                  <span className={`chip text-[10px] ${PRIORITY[l.priority]}`}>{l.priority}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="truncate">{hideAgent ? (l.field || '—') : (l.agentName || 'Unassigned')}</span>
                  {l.followUpAt && <span className={new Date(l.followUpAt) < new Date() ? 'text-accent-red font-bold' : ''}>{relTime(l.followUpAt)}</span>}
                </div>
              </div>
            ))}
            {col.leads.length === 0 && <div className="text-center text-xs text-neutral-500 dark:text-neutral-500 py-6 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl">Drop here</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- CSV Import ---------------- */
function ImportModal({ open, onClose, onDone }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const parse = (text) => {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = line.split(',');
      const o = {};
      headers.forEach((h, i) => { o[h] = (cells[i] || '').trim(); });
      return o;
    }).filter((r) => r.name);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRows(parse(String(reader.result)));
    reader.readAsText(file);
  };

  const sample = () => {
    const csv = 'name,phone,email,field,budget\nJane Cooper,+1 415-555-1234,jane@email.com,Website,650000\nMark Diaz,+1 415-555-9988,mark@email.com,Referral,1200000';
    setRows(parse(csv));
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const { inserted } = await api.post('/leads/import', { rows });
      toast.success(`Imported ${inserted} leads`);
      setRows([]); onDone(); onClose();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bulk import leads"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!rows.length || busy} onClick={doImport}>
          {busy ? <Spinner className="w-4 h-4 border-white/40 border-t-white" /> : `Import ${rows.length || ''} leads`}</button>
      </>}>
      <label className="block border-2 border-dashed border-neutral-400 dark:border-neutral-700 rounded-2xl p-8 text-center cursor-pointer hover:border-primary-500 dark:border-primary-400 hover:bg-primary-500 dark:bg-primary-600/5 transition">
        <input type="file" accept=".csv" className="hidden" onChange={onFile} />
        <div className="text-3xl mb-2 opacity-40">📄</div>
        <div className="font-semibold text-neutral-700 dark:text-neutral-200">Drop a CSV file here</div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Columns: name, phone, email, field, budget</div>
      </label>
      <button className="btn-ghost w-full mt-3" onClick={sample}>Import sample CSV</button>
      {rows.length > 0 && <p className="text-sm font-semibold text-primary-500 dark:text-primary-400 mt-3">{rows.length} rows ready to import.</p>}
    </Modal>
  );
}
