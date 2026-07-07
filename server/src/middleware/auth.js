import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(account) {
  return jwt.sign({ sub: account.id }, SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}

// Loads the account + role permissions onto req.user. Caches nothing — the
// query is a single indexed join, fast enough to run per request.
export async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = bearer || req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { sub } = jwt.verify(token, SECRET);
    const { rows } = await query(
      `SELECT a.id, a.name, a.email, a.account_type, a.company, a.avatar_url,
              a.commission_cents, a.is_active, a.role_id,
              r.name AS role_name, r.permissions
         FROM accounts a
         LEFT JOIN roles r ON r.id = a.role_id
        WHERE a.id = $1`,
      [sub]
    );
    const user = rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'Account inactive' });

    const permissions = user.permissions || {};
    const isAdmin = user.account_type === 'admin';
    req.user = {
      ...user,
      permissions,
      isAdmin,
      // account type implies hard-coded capabilities on top of the role
      can: (key) => isAdmin || !!permissions[key],
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Guard a route by one or more permission keys (any-of). Admins always pass.
export function requirePermission(...keys) {
  return (req, res, next) => {
    if (req.user?.isAdmin) return next();
    const perms = req.user?.permissions || {};
    if (keys.some((k) => perms[k])) return next();
    res.status(403).json({ error: 'You do not have permission to do that' });
  };
}

// Restrict to specific account types.
export function requireAccountType(...types) {
  return (req, res, next) => {
    if (types.includes(req.user?.account_type)) return next();
    res.status(403).json({ error: 'Not permitted for your account type' });
  };
}
