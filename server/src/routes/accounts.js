import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { accountOut, dollarsToCents } from '../utils/serialize.js';

const router = Router();
router.use(authRequired);

const TYPES = ['admin', 'owner', 'employee', 'affiliate'];

// GET /api/accounts — admins get the full directory; others get a slim list
// (and owners/affiliates get NO directory of employees at all).
router.get('/', async (req, res) => {
  const full = req.user.isAdmin;
  if (!full && (req.user.account_type === 'owner' || req.user.account_type === 'affiliate')) {
    return res.json({ accounts: [] }); // these types must not see staff
  }
  const { rows } = await query(
    `SELECT a.*, r.name AS role_name FROM accounts a LEFT JOIN roles r ON r.id=a.role_id ORDER BY a.account_type, a.created_at`
  );
  res.json({ accounts: rows.map((r) => (full ? accountOut(r) : { id: r.id, name: r.name, accountType: r.account_type })) });
});

// Everything below: admin only
router.use(requirePermission('canManageAccounts'));

// POST /api/accounts — create any account internally
router.post('/', async (req, res) => {
  const { name, email, password, accountType, roleId, company, phone, commission, avatarUrl, eventIds = [] } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (!TYPES.includes(accountType)) return res.status(400).json({ error: 'Invalid account type' });

  const exists = await query('SELECT 1 FROM accounts WHERE email=$1', [email.trim()]);
  if (exists.rowCount) return res.status(409).json({ error: 'An account with that email already exists' });

  const { rows } = await query(
    `INSERT INTO accounts (name, email, password_hash, account_type, role_id, company, phone, commission_cents, avatar_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [name.trim(), email.trim(), bcrypt.hashSync(password, 10), accountType, roleId || null,
     company || '', phone || '', dollarsToCents(commission), avatarUrl || null]
  );
  // owners are linked to events
  if (accountType === 'owner') {
    for (const eid of eventIds) await query('INSERT INTO event_owners (event_id, account_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [eid, rows[0].id]);
  }
  res.status(201).json({ id: rows[0].id });
});

// GET /api/accounts/:id — detail incl. linked events (for owners)
router.get('/detail/:id', async (req, res) => {
  const acct = (await query(`SELECT a.*, r.name AS role_name FROM accounts a LEFT JOIN roles r ON r.id=a.role_id WHERE a.id=$1`, [req.params.id])).rows[0];
  if (!acct) return res.status(404).json({ error: 'Account not found' });
  const events = await query('SELECT event_id FROM event_owners WHERE account_id=$1', [req.params.id]);
  res.json({ account: accountOut(acct), eventIds: events.rows.map((r) => r.event_id) });
});

// PUT /api/accounts/:id
router.put('/:id', async (req, res) => {
  const { name, accountType, roleId, company, phone, commission, avatarUrl, isActive, eventIds } = req.body || {};
  const { rows } = await query(
    `UPDATE accounts SET
        name = coalesce($1,name),
        account_type = coalesce($2,account_type),
        role_id = $3,
        company = coalesce($4,company),
        phone = coalesce($5,phone),
        commission_cents = coalesce($6,commission_cents),
        avatar_url = $7,
        is_active = coalesce($8,is_active)
      WHERE id=$9 RETURNING id, account_type`,
    [name?.trim() || null, TYPES.includes(accountType) ? accountType : null, roleId || null,
     company ?? null, phone ?? null, commission != null ? dollarsToCents(commission) : null,
     avatarUrl || null, typeof isActive === 'boolean' ? isActive : null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Account not found' });
  if (Array.isArray(eventIds)) {
    await query('DELETE FROM event_owners WHERE account_id=$1', [req.params.id]);
    for (const eid of eventIds) await query('INSERT INTO event_owners (event_id, account_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [eid, req.params.id]);
  }
  res.json({ ok: true });
});

// POST /api/accounts/:id/password — admin resets password for any account
router.post('/:id/password', async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  const { rowCount } = await query('UPDATE accounts SET password_hash=$1 WHERE id=$2', [bcrypt.hashSync(newPassword, 10), req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Account not found' });
  await query('INSERT INTO auth_log (account_id, action) VALUES ($1,$2)', [req.params.id, `password reset by admin ${req.user.name}`]);
  res.json({ ok: true });
});

// DELETE /api/accounts/:id — soft deactivate (default) or ?hard=1
router.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  if (req.query.hard === '1') await query('DELETE FROM accounts WHERE id=$1', [req.params.id]);
  else await query('UPDATE accounts SET is_active=FALSE WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
