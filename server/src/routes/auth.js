import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query } from '../db/pool.js';
import { signToken, authRequired } from '../middleware/auth.js';
import { accountOut } from '../utils/serialize.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please wait a few minutes.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const { rows } = await query(
    `SELECT a.*, r.name AS role_name, r.permissions
       FROM accounts a LEFT JOIN roles r ON r.id = a.role_id
      WHERE a.email = $1`,
    [email]
  );
  const acct = rows[0];
  if (!acct || !acct.is_active || !bcrypt.compareSync(password, acct.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  await query('UPDATE accounts SET last_login_at = now() WHERE id = $1', [acct.id]);
  await query('INSERT INTO auth_log (account_id, action) VALUES ($1, $2)', [acct.id, 'login']);

  const token = signToken(acct);
  res.cookie?.('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5 });
  res.json({
    token,
    user: { ...accountOut(acct), roleName: acct.role_name, permissions: acct.permissions || {} },
  });
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: { ...req.user, password_hash: undefined } });
});

router.post('/logout', authRequired, (req, res) => {
  res.clearCookie?.('token');
  res.json({ ok: true });
});

// A user changing their OWN password (must supply current password).
router.post('/change-password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }
  const { rows } = await query('SELECT password_hash FROM accounts WHERE id = $1', [req.user.id]);
  if (!bcrypt.compareSync(currentPassword || '', rows[0].password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  await query('UPDATE accounts SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(newPassword, 10), req.user.id]);
  res.json({ ok: true });
});

export default router;
