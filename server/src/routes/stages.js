import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

// GET /api/stages — ordered pipeline stages
router.get('/', async (_req, res) => {
  const { rows } = await query('SELECT * FROM stages ORDER BY position');
  res.json({
    stages: rows.map((s) => ({ id: s.id, name: s.name, color: s.color, position: s.position, isWon: s.is_won, isLost: s.is_lost, isAffiliateMin: s.is_affiliate_min })),
  });
});

router.use(requirePermission('canManageStages'));

// POST /api/stages — add stage at the end
router.post('/', async (req, res) => {
  const { name, color, isWon, isLost } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Stage name is required' });
  const pos = (await query('SELECT coalesce(max(position),-1)+1 AS p FROM stages')).rows[0].p;
  const { rows } = await query(
    'INSERT INTO stages (name, color, position, is_won, is_lost) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [name.trim(), color || '#2F7E7E', pos, !!isWon, !!isLost]
  );
  res.status(201).json({ id: rows[0].id });
});

// PUT /api/stages/:id — rename / recolor / flags
router.put('/:id', async (req, res) => {
  const { name, color, isWon, isLost, isAffiliateMin } = req.body || {};
  await query(
    `UPDATE stages SET name=coalesce($1,name), color=coalesce($2,color),
        is_won=coalesce($3,is_won), is_lost=coalesce($4,is_lost), is_affiliate_min=coalesce($5,is_affiliate_min)
      WHERE id=$6`,
    [name?.trim() || null, color || null,
     typeof isWon === 'boolean' ? isWon : null, typeof isLost === 'boolean' ? isLost : null,
     typeof isAffiliateMin === 'boolean' ? isAffiliateMin : null, req.params.id]
  );
  res.json({ ok: true });
});

// PUT /api/stages — reorder (array of ids in new order)
router.put('/', async (req, res) => {
  const { order = [] } = req.body || {};
  for (let i = 0; i < order.length; i++) {
    await query('UPDATE stages SET position=$1 WHERE id=$2', [i, order[i]]);
  }
  res.json({ ok: true });
});

// DELETE /api/stages/:id — leads on that stage get null stage
router.delete('/:id', async (req, res) => {
  const count = (await query('SELECT count(*) FROM stages')).rows[0].count;
  if (Number(count) <= 1) return res.status(400).json({ error: 'You need at least one stage' });
  await query('DELETE FROM stages WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
