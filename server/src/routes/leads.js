import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { leadOut, dollarsToCents } from '../utils/serialize.js';
import { scopeForAccountType } from '../utils/permissions.js';

const router = Router();
router.use(authRequired);

const LEAD_SELECT = `
  SELECT l.*, s.name AS stage_name, s.color AS stage_color, s.is_won AS stage_is_won,
         ag.name AS agent_name, ev.name AS event_name, ab.name AS added_by_name,
         ex.title AS expense_title,
         (SELECT count(*) FROM activities ac WHERE ac.lead_id = l.id) AS activity_count
    FROM leads l
    LEFT JOIN stages s    ON s.id = l.stage_id
    LEFT JOIN accounts ag ON ag.id = l.agent_id
    LEFT JOIN events ev   ON ev.id = l.event_id
    LEFT JOIN accounts ab ON ab.id = l.added_by
    LEFT JOIN expenses ex ON ex.id = l.expense_id`;

const SORTS = {
  followup: 'l.follow_up_at ASC NULLS LAST',
  name: 'l.name ASC',
  score: 'l.score DESC',
  stage: 's.position ASC NULLS LAST, l.created_at DESC',
  created: 'l.created_at DESC',
};

// account-type scoping -> extra WHERE + whether to hide agent identity
function scope(req) {
  const s = scopeForAccountType(req.user.account_type);
  if (s === 'own') return { sql: 'l.added_by', val: req.user.id, hideAgent: false };
  if (s === 'all_no_agent') return { sql: null, val: null, hideAgent: true };
  return { sql: null, val: null, hideAgent: false };
}

function buildFilters(q, req) {
  const where = [];
  const params = [];
  const sc = scope(req);
  if (sc.sql) { params.push(sc.val); where.push(`${sc.sql} = $${params.length}`); }

  if (q.search) {
    params.push(`%${q.search}%`);
    where.push(`(l.name ILIKE $${params.length} OR l.email ILIKE $${params.length} OR l.phone ILIKE $${params.length})`);
  }
  if (q.stage)    { params.push(q.stage);    where.push(`l.stage_id = $${params.length}`); }
  if (q.agent)    { params.push(q.agent);    where.push(`l.agent_id = $${params.length}`); }
  if (q.field)    { params.push(q.field);    where.push(`l.field = $${params.length}`); }
  if (q.event)    { params.push(q.event);    where.push(`l.event_id = $${params.length}`); }
  if (q.expense)  { params.push(q.expense);  where.push(`l.expense_id = $${params.length}`); }
  if (q.priority) { params.push(q.priority); where.push(`l.priority = $${params.length}`); }
  if (q.tag)      { params.push([q.tag]);    where.push(`l.tags @> $${params.length}`); }
  if (q.from)     { params.push(q.from);     where.push(`l.created_at >= $${params.length}`); }
  if (q.to)       { params.push(q.to);       where.push(`l.created_at <= $${params.length}`); }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params, hideAgent: sc.hideAgent };
}

// GET /api/leads — paginated list
router.get('/', async (req, res) => {
  const { clause, params, hideAgent } = buildFilters(req.query, req);
  const sort = SORTS[req.query.sort] || SORTS.followup;
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const [countRes, listRes] = await Promise.all([
    query(`SELECT count(*) FROM leads l LEFT JOIN stages s ON s.id=l.stage_id ${clause}`, params),
    query(`${LEAD_SELECT} ${clause} ORDER BY ${sort} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
  ]);
  res.json({ total: Number(countRes.rows[0].count), leads: listRes.rows.map((r) => leadOut(r, hideAgent)) });
});

// GET /api/leads/board — grouped by stage
router.get('/board', async (req, res) => {
  const { clause, params, hideAgent } = buildFilters(req.query, req);
  const { rows } = await query(`${LEAD_SELECT} ${clause} ORDER BY l.follow_up_at ASC NULLS LAST, l.score DESC`, params);
  const stages = (await query('SELECT * FROM stages ORDER BY position')).rows;
  const byStage = Object.fromEntries(stages.map((s) => [s.id, []]));
  for (const r of rows) if (byStage[r.stage_id]) byStage[r.stage_id].push(leadOut(r, hideAgent));
  res.json({
    columns: stages.map((s) => ({ id: s.id, name: s.name, color: s.color, isWon: s.is_won, isLost: s.is_lost, leads: byStage[s.id] })),
  });
});

// GET /api/leads/meta/filters — distinct fields & tags for dropdowns
router.get('/meta/filters', async (_req, res) => {
  const fields = await query(`SELECT DISTINCT field FROM leads WHERE field <> '' ORDER BY field`);
  const tags = await query('SELECT DISTINCT unnest(tags) AS tag FROM leads ORDER BY tag');
  res.json({ fields: fields.rows.map((r) => r.field), tags: tags.rows.map((r) => r.tag) });
});

// GET /api/leads/export/csv
router.get('/export/csv', requirePermission('canImportExport'), async (req, res) => {
  const { clause, params, hideAgent } = buildFilters(req.query, req);
  const { rows } = await query(`${LEAD_SELECT} ${clause} ORDER BY l.created_at DESC`, params);
  const headers = ['name', 'phone', 'email', 'address', 'budget', 'field', 'source', 'score', 'priority', 'stage', ...(hideAgent ? [] : ['agent']), 'expense', 'tags', 'followUpAt', 'createdAt'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const r of rows) {
    const l = leadOut(r, hideAgent);
    const base = [l.name, l.phone, l.email, l.address, l.budget, l.field, l.source, l.score, l.priority, l.stageName];
    if (!hideAgent) base.push(l.agentName);
    base.push(l.expenseTitle, (l.tags || []).join('|'), l.followUpAt, l.createdAt);
    lines.push(base.map(esc).join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sky-root-leads.csv"');
  res.send(lines.join('\n'));
});

// GET /api/leads/:id — detail + timeline
router.get('/:id', async (req, res) => {
  const { hideAgent } = scope(req);
  const { rows } = await query(`${LEAD_SELECT} WHERE l.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Lead not found' });
  // affiliates can only open their own leads
  if (req.user.account_type === 'affiliate' && rows[0].added_by !== req.user.id) {
    return res.status(403).json({ error: 'Not your lead' });
  }
  const acts = await query(
    `SELECT ac.*, a.name AS account_name FROM activities ac
       LEFT JOIN accounts a ON a.id = ac.account_id
      WHERE ac.lead_id = $1 ORDER BY ac.created_at DESC`,
    [req.params.id]
  );
  res.json({
    lead: leadOut(rows[0], hideAgent),
    activities: acts.rows.map((a) => ({ id: a.id, type: a.type, body: a.body, who: hideAgent ? null : a.account_name, createdAt: a.created_at })),
  });
});

function leadBody(b) {
  return {
    name: b.name?.trim(),
    phone: b.phone || '',
    email: b.email || null,
    address: b.address || '',
    budget_cents: dollarsToCents(b.budget),
    field: b.field || '',
    source: b.source || '',
    score: Math.max(0, Math.min(100, Number(b.score) || 0)),
    priority: ['low', 'medium', 'high'].includes(b.priority) ? b.priority : 'medium',
    tags: Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    photo_url: b.photoUrl || null,
    stage_id: b.stageId || null,
    agent_id: b.agentId || null,
    event_id: b.eventId || null,
    expense_id: b.expenseId || null,
    follow_up_at: b.followUpAt || null,
  };
}

// Affiliates may only place leads at the "affiliate minimum" stage or above.
async function enforceAffiliateStage(req, d) {
  if (req.user.account_type !== 'affiliate') return d;
  const minStage = (await query('SELECT id, position FROM stages WHERE is_affiliate_min = TRUE ORDER BY position LIMIT 1')).rows[0]
    || (await query('SELECT id, position FROM stages ORDER BY position LIMIT 1')).rows[0];
  const chosen = d.stage_id ? (await query('SELECT position FROM stages WHERE id=$1', [d.stage_id])).rows[0] : null;
  if (!chosen || chosen.position < minStage.position) d.stage_id = minStage.id;
  d.agent_id = null; // affiliates never assign agents
  return d;
}

// POST /api/leads
router.post('/', requirePermission('canAddLead'), async (req, res) => {
  let d = leadBody(req.body);
  if (!d.name) return res.status(400).json({ error: 'Name is required' });
  d = await enforceAffiliateStage(req, d);
  const { rows } = await query(
    `INSERT INTO leads (name, phone, email, address, budget_cents, field, source, score, priority,
        tags, photo_url, stage_id, agent_id, event_id, expense_id, added_by, follow_up_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
    [d.name, d.phone, d.email, d.address, d.budget_cents, d.field, d.source, d.score, d.priority,
     d.tags, d.photo_url, d.stage_id, d.agent_id, d.event_id, d.expense_id, req.user.id, d.follow_up_at]
  );
  await query('INSERT INTO activities (lead_id, account_id, type, body) VALUES ($1,$2,$3,$4)',
    [rows[0].id, req.user.id, 'system', `Lead created by ${req.user.name}`]);
  const full = await query(`${LEAD_SELECT} WHERE l.id = $1`, [rows[0].id]);
  res.status(201).json({ lead: leadOut(full.rows[0]) });
});

// PUT /api/leads/:id
router.put('/:id', requirePermission('canEditLead', 'canAddLead'), async (req, res) => {
  let d = leadBody(req.body);
  const prev = (await query('SELECT added_by, won_at FROM leads WHERE id = $1', [req.params.id])).rows[0];
  if (!prev) return res.status(404).json({ error: 'Lead not found' });
  if (req.user.account_type === 'affiliate' && prev.added_by !== req.user.id) {
    return res.status(403).json({ error: 'Not your lead' });
  }
  d = await enforceAffiliateStage(req, d);
  const newStage = await query('SELECT is_won FROM stages WHERE id = $1', [d.stage_id]);
  const becameWon = newStage.rows[0]?.is_won && !prev.won_at;
  await query(
    `UPDATE leads SET name=$1, phone=$2, email=$3, address=$4, budget_cents=$5, field=$6, source=$7,
        score=$8, priority=$9, tags=$10, photo_url=$11, stage_id=$12, agent_id=$13, event_id=$14,
        expense_id=$15, follow_up_at=$16, won_at = CASE WHEN $17 THEN now() ELSE won_at END
      WHERE id=$18`,
    [d.name, d.phone, d.email, d.address, d.budget_cents, d.field, d.source, d.score, d.priority,
     d.tags, d.photo_url, d.stage_id, d.agent_id, d.event_id, d.expense_id, d.follow_up_at, becameWon, req.params.id]
  );
  const full = await query(`${LEAD_SELECT} WHERE l.id = $1`, [req.params.id]);
  res.json({ lead: leadOut(full.rows[0], scope(req).hideAgent) });
});

// PATCH /api/leads/:id/stage — kanban drag
router.patch('/:id/stage', requirePermission('canAssignLead', 'canEditLead', 'canAddLead'), async (req, res) => {
  const stage = (await query('SELECT name, is_won, position FROM stages WHERE id=$1', [req.body?.stageId])).rows[0];
  if (!stage) return res.status(400).json({ error: 'Unknown stage' });
  if (req.user.account_type === 'affiliate') {
    const min = (await query('SELECT position FROM stages WHERE is_affiliate_min=TRUE LIMIT 1')).rows[0];
    if (min && stage.position < min.position) return res.status(403).json({ error: 'Affiliates cannot use earlier stages' });
  }
  await query(`UPDATE leads SET stage_id=$1, won_at = CASE WHEN $2 AND won_at IS NULL THEN now() ELSE won_at END WHERE id=$3`,
    [req.body.stageId, stage.is_won, req.params.id]);
  await query('INSERT INTO activities (lead_id, account_id, type, body) VALUES ($1,$2,$3,$4)',
    [req.params.id, req.user.id, 'stage_change', `Moved to ${stage.name}`]);
  res.json({ ok: true });
});

// POST /api/leads/:id/activities
router.post('/:id/activities', async (req, res) => {
  const { type, body } = req.body || {};
  if (!['call', 'email', 'whatsapp', 'note', 'viewing'].includes(type)) return res.status(400).json({ error: 'Invalid activity type' });
  const { rows } = await query('INSERT INTO activities (lead_id, account_id, type, body) VALUES ($1,$2,$3,$4) RETURNING id, created_at',
    [req.params.id, req.user.id, type, body || '']);
  await query('UPDATE leads SET updated_at = now() WHERE id = $1', [req.params.id]);
  res.status(201).json({ id: rows[0].id, type, body, who: req.user.name, createdAt: rows[0].created_at });
});

// POST /api/leads/bulk
router.post('/bulk', async (req, res) => {
  const { ids = [], action, value } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No leads selected' });
  const can = req.user.isAdmin ? () => true : (k) => req.user.permissions[k];
  try {
    await withTransaction(async (c) => {
      if (action === 'stage') {
        if (!can('canAssignLead') && !can('canEditLead')) throw Object.assign(new Error(), { code: 403 });
        const stage = (await c.query('SELECT is_won FROM stages WHERE id=$1', [value])).rows[0];
        await c.query(`UPDATE leads SET stage_id=$1, won_at = CASE WHEN $2 AND won_at IS NULL THEN now() ELSE won_at END WHERE id = ANY($3)`, [value, stage?.is_won || false, ids]);
      } else if (action === 'assign') {
        if (!can('canAssignLead')) throw Object.assign(new Error(), { code: 403 });
        await c.query('UPDATE leads SET agent_id=$1 WHERE id = ANY($2)', [value || null, ids]);
      } else if (action === 'tag') {
        if (!can('canEditLead')) throw Object.assign(new Error(), { code: 403 });
        await c.query(`UPDATE leads SET tags = (SELECT array_agg(DISTINCT t) FROM unnest(tags || $1::text[]) t) WHERE id = ANY($2)`, [[value], ids]);
      } else if (action === 'delete') {
        if (!can('canDeleteLead')) throw Object.assign(new Error(), { code: 403 });
        await c.query('DELETE FROM leads WHERE id = ANY($1)', [ids]);
      } else throw Object.assign(new Error('Unknown action'), { code: 400 });
    });
    res.json({ ok: true, affected: ids.length });
  } catch (err) {
    res.status(err.code || 500).json({ error: err.code === 403 ? 'Not permitted' : 'Bulk action failed' });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', requirePermission('canDeleteLead'), async (req, res) => {
  await query('DELETE FROM leads WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// POST /api/leads/import — bulk insert from parsed CSV rows
router.post('/import', requirePermission('canImportExport'), async (req, res) => {
  const { rows = [] } = req.body || {};
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'No rows to import' });
  const stage = (await query('SELECT id FROM stages ORDER BY position LIMIT 1')).rows[0];
  let inserted = 0;
  await withTransaction(async (c) => {
    for (const r of rows) {
      if (!r.name) continue;
      await c.query(
        `INSERT INTO leads (name, phone, email, budget_cents, field, source, score, stage_id, added_by, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [r.name, r.phone || '', r.email || null, dollarsToCents(r.budget), r.field || r.channel || '',
         r.source || r.status || '', Math.max(0, Math.min(100, Number(r.score) || 0)), stage?.id || null, req.user.id,
         r.tags ? String(r.tags).split('|').map((t) => t.trim()).filter(Boolean) : []]
      );
      inserted++;
    }
  });
  res.json({ ok: true, inserted });
});

export default router;
