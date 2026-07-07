import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { PERMISSION_KEYS, permissionsFromList } from '../utils/permissions.js';

const router = Router();
router.use(authRequired);

// GET /api/roles — list roles + the catalogue of permission keys
router.get('/', async (_req, res) => {
  const { rows } = await query(`
    SELECT r.*, (SELECT count(*) FROM accounts a WHERE a.role_id=r.id) AS member_count
      FROM roles r ORDER BY r.is_system DESC, r.name`);
  res.json({
    permissionKeys: PERMISSION_KEYS,
    roles: rows.map((r) => ({
      id: r.id, name: r.name, description: r.description, isSystem: r.is_system,
      permissions: r.permissions || {}, memberCount: Number(r.member_count),
    })),
  });
});

router.use(requirePermission('canManageAccounts'));

// POST /api/roles — create custom role
router.post('/', async (req, res) => {
  const { name, description, permissions = [] } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Role name is required' });
  const perms = Array.isArray(permissions) ? permissionsFromList(permissions) : permissions;
  try {
    const { rows } = await query(
      'INSERT INTO roles (name, description, permissions, is_system) VALUES ($1,$2,$3,FALSE) RETURNING id',
      [name.trim(), description || '', JSON.stringify(perms)]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A role with that name already exists' });
    throw e;
  }
});

// PUT /api/roles/:id — update permissions/description (system roles: perms only)
router.put('/:id', async (req, res) => {
  const { name, description, permissions } = req.body || {};
  const perms = Array.isArray(permissions) ? permissionsFromList(permissions) : permissions;
  const role = (await query('SELECT is_system FROM roles WHERE id=$1', [req.params.id])).rows[0];
  if (!role) return res.status(404).json({ error: 'Role not found' });
  await query(
    `UPDATE roles SET name = CASE WHEN $1 THEN name ELSE coalesce($2,name) END,
        description = coalesce($3,description),
        permissions = coalesce($4,permissions)
      WHERE id=$5`,
    [role.is_system, name?.trim() || null, description ?? null, perms ? JSON.stringify(perms) : null, req.params.id]
  );
  res.json({ ok: true });
});

// DELETE /api/roles/:id — only custom roles
router.delete('/:id', async (req, res) => {
  const role = (await query('SELECT is_system FROM roles WHERE id=$1', [req.params.id])).rows[0];
  if (!role) return res.status(404).json({ error: 'Role not found' });
  if (role.is_system) return res.status(400).json({ error: 'System roles cannot be deleted' });
  await query('DELETE FROM roles WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
