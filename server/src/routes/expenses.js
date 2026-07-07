import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { expenseOut, dollarsToCents, centsToDollars } from '../utils/serialize.js';

const router = Router();
router.use(authRequired);

const EXPENSE_SELECT = `
  SELECT x.*, ev.name AS event_name, cb.name AS created_by_name,
         (SELECT count(*) FROM leads l WHERE l.expense_id = x.id) AS lead_count,
         (SELECT count(*) FROM leads l JOIN stages s ON s.id=l.stage_id WHERE l.expense_id = x.id AND s.is_won) AS won_count
    FROM expenses x
    LEFT JOIN events ev   ON ev.id = x.event_id
    LEFT JOIN accounts cb ON cb.id = x.created_by`;

// GET /api/expenses — list with optional field/event/date filters
router.get('/', async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.field)  { params.push(req.query.field);  where.push(`x.field = $${params.length}`); }
  if (req.query.event)  { params.push(req.query.event);  where.push(`x.event_id = $${params.length}`); }
  if (req.query.search) { params.push(`%${req.query.search}%`); where.push(`x.title ILIKE $${params.length}`); }
  if (req.query.from)   { params.push(req.query.from);   where.push(`x.period_to >= $${params.length}`); }
  if (req.query.to)     { params.push(req.query.to);     where.push(`x.period_from <= $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await query(`${EXPENSE_SELECT} ${clause} ORDER BY x.period_from DESC NULLS LAST, x.created_at DESC`, params);
  const total = rows.reduce((s, r) => s + Number(r.amount_cents), 0);

  // grouped totals by title (one title may have many rows) and by field
  const byTitle = {};
  const byField = {};
  for (const r of rows) {
    byTitle[r.title] = (byTitle[r.title] || 0) + Number(r.amount_cents);
    byField[r.field || 'Uncategorised'] = (byField[r.field || 'Uncategorised'] || 0) + Number(r.amount_cents);
  }
  res.json({
    expenses: rows.map(expenseOut),
    totalSpend: centsToDollars(total),
    byTitle: Object.entries(byTitle).map(([title, c]) => ({ title, amount: centsToDollars(c) })).sort((a, b) => b.amount - a.amount),
    byField: Object.entries(byField).map(([field, c]) => ({ field, amount: centsToDollars(c) })).sort((a, b) => b.amount - a.amount),
  });
});

// GET /api/expenses/options — slim list for the "which expense brought this lead" picker
router.get('/options', async (_req, res) => {
  const { rows } = await query(`SELECT id, title, field, period_from, period_to FROM expenses ORDER BY period_from DESC NULLS LAST, title`);
  res.json({ options: rows.map((r) => ({ id: r.id, title: r.title, field: r.field, periodFrom: r.period_from, periodTo: r.period_to })) });
});

// GET /api/expenses/fields — distinct fields for dropdowns
router.get('/fields', async (_req, res) => {
  const { rows } = await query(`SELECT DISTINCT field FROM expenses WHERE field <> '' ORDER BY field`);
  res.json({ fields: rows.map((r) => r.field) });
});

router.use(requirePermission('canManageExpenses'));

function body(b) {
  return {
    title: b.title?.trim(),
    description: b.description || '',
    field: b.field?.trim() || '',
    amount_cents: dollarsToCents(b.amount),
    period_from: b.periodFrom || null,
    period_to: b.periodTo || null,
    event_id: b.eventId || null,
  };
}

// POST /api/expenses
router.post('/', async (req, res) => {
  const d = body(req.body);
  if (!d.title) return res.status(400).json({ error: 'Title is required' });
  const { rows } = await query(
    `INSERT INTO expenses (title, description, field, amount_cents, period_from, period_to, event_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [d.title, d.description, d.field, d.amount_cents, d.period_from, d.period_to, d.event_id, req.user.id]
  );
  res.status(201).json({ id: rows[0].id });
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res) => {
  const d = body(req.body);
  const { rowCount } = await query(
    `UPDATE expenses SET title=$1, description=$2, field=$3, amount_cents=$4, period_from=$5, period_to=$6, event_id=$7 WHERE id=$8`,
    [d.title, d.description, d.field, d.amount_cents, d.period_from, d.period_to, d.event_id, req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Expense not found' });
  res.json({ ok: true });
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  await query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
