import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { eventOut, centsToDollars } from '../utils/serialize.js';

const router = Router();
router.use(authRequired);

// Owners only see events they're linked to; everyone else sees all.
function ownerScope(req) {
  if (req.user.account_type === 'owner') {
    return { join: 'JOIN event_owners eo ON eo.event_id = e.id AND eo.account_id = $OWNER', owner: req.user.id };
  }
  return { join: '', owner: null };
}

// GET /api/events
router.get('/', async (req, res) => {
  const sc = ownerScope(req);
  const params = [];
  let join = '';
  if (sc.owner) { params.push(sc.owner); join = sc.join.replace('$OWNER', `$${params.length}`); }
  const { rows } = await query(`
    SELECT e.*,
      (SELECT count(*) FROM leads l WHERE l.event_id=e.id) AS lead_count,
      (SELECT count(*) FROM leads l JOIN stages s ON s.id=l.stage_id WHERE l.event_id=e.id AND s.is_won) AS won_count,
      (SELECT coalesce(sum(amount_cents),0) FROM expenses x WHERE x.event_id=e.id) AS spend_cents
    FROM events e ${join}
    ORDER BY e.event_date DESC NULLS LAST, e.created_at DESC`, params);
  res.json({ events: rows.map(eventOut) });
});

// GET /api/events/:id
router.get('/:id', async (req, res) => {
  const ev = (await query('SELECT * FROM events WHERE id=$1', [req.params.id])).rows[0];
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  if (req.user.account_type === 'owner') {
    const owns = await query('SELECT 1 FROM event_owners WHERE event_id=$1 AND account_id=$2', [req.params.id, req.user.id]);
    if (!owns.rowCount) return res.status(403).json({ error: 'Not your event' });
  }
  const hideAgent = req.user.account_type === 'owner';

  const [owners, expenses, pipeline, counts] = await Promise.all([
    query(`SELECT a.id, a.name, a.avatar_url FROM event_owners eo JOIN accounts a ON a.id=eo.account_id WHERE eo.event_id=$1`, [req.params.id]),
    query(`SELECT x.*, cb.name AS created_by_name FROM expenses x LEFT JOIN accounts cb ON cb.id=x.created_by WHERE x.event_id=$1 ORDER BY x.created_at DESC`, [req.params.id]),
    query(`SELECT s.id, s.name, s.color, s.position, count(l.id) AS cnt
             FROM stages s LEFT JOIN leads l ON l.stage_id=s.id AND l.event_id=$1 GROUP BY s.id ORDER BY s.position`, [req.params.id]),
    query(`SELECT count(*) AS leads, count(*) FILTER (WHERE s.is_won) AS won
             FROM leads l JOIN stages s ON s.id=l.stage_id WHERE l.event_id=$1`, [req.params.id]),
  ]);
  const spend = (await query('SELECT coalesce(sum(amount_cents),0) c FROM expenses WHERE event_id=$1', [req.params.id])).rows[0].c;

  res.json({
    event: { ...eventOut(ev), leadCount: Number(counts.rows[0].leads), wonCount: Number(counts.rows[0].won), spend: centsToDollars(Number(spend)) },
    owners: hideAgent ? [] : owners.rows.map((o) => ({ id: o.id, name: o.name, avatarUrl: o.avatar_url })),
    expenses: expenses.rows.map((x) => ({ id: x.id, title: x.title, description: x.description, field: x.field, amount: centsToDollars(Number(x.amount_cents)), periodFrom: x.period_from, periodTo: x.period_to, createdAt: x.created_at })),
    pipeline: pipeline.rows.map((r) => ({ id: r.id, name: r.name, color: r.color, count: Number(r.cnt) })),
  });
});

router.use(requirePermission('canManageEvents'));

// POST /api/events
router.post('/', async (req, res) => {
  const { name, description, location, coverUrl, eventDate, leadTarget, ownerIds = [] } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Event name is required' });
  const { rows } = await query(
    `INSERT INTO events (name, description, location, cover_url, event_date, lead_target) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [name.trim(), description || '', location || '', coverUrl || null, eventDate || null, Number(leadTarget) || 0]
  );
  for (const oid of ownerIds) await query('INSERT INTO event_owners (event_id, account_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, oid]);
  res.status(201).json({ id: rows[0].id });
});

// PUT /api/events/:id
router.put('/:id', async (req, res) => {
  const { name, description, location, coverUrl, eventDate, leadTarget, ownerIds } = req.body || {};
  await query(`UPDATE events SET name=$1, description=$2, location=$3, cover_url=$4, event_date=$5, lead_target=$6 WHERE id=$7`,
    [name?.trim(), description || '', location || '', coverUrl || null, eventDate || null, Number(leadTarget) || 0, req.params.id]);
  if (Array.isArray(ownerIds)) {
    await query('DELETE FROM event_owners WHERE event_id=$1', [req.params.id]);
    for (const oid of ownerIds) await query('INSERT INTO event_owners (event_id, account_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, oid]);
  }
  res.json({ ok: true });
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
  await query('DELETE FROM events WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
