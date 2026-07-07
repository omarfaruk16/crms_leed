import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { centsToDollars } from '../utils/serialize.js';
import { scopeForAccountType } from '../utils/permissions.js';

const router = Router();
router.use(authRequired, requirePermission('canViewAnalytics'));

// GET /api/analytics — rich metrics for visual dashboards.
// Optional ?from=&to= date range narrows every lead aggregate.
router.get('/', async (req, res) => {
  const sc = scopeForAccountType(req.user.account_type);
  const hideAgent = sc === 'all_no_agent';
  const own = sc === 'own';

  // shared lead filter (date range + own-scope)
  const lf = [];
  const lp = [];
  if (own) { lp.push(req.user.id); lf.push(`l.added_by = $${lp.length}`); }
  if (req.query.from) { lp.push(req.query.from); lf.push(`l.created_at >= $${lp.length}`); }
  if (req.query.to)   { lp.push(req.query.to);   lf.push(`l.created_at <= $${lp.length}`); }
  const lw = lf.length ? `WHERE ${lf.join(' AND ')}` : '';

  const [monthly, sources, fields, funnel, leaderboard, byPriority, budgetBuckets, spendByField, eventPerf, totals] = await Promise.all([
    // New leads + won per month (12 months)
    query(`
      SELECT to_char(date_trunc('month', l.created_at),'Mon YY') AS label, date_trunc('month', l.created_at) AS m,
             count(*) AS cnt, count(*) FILTER (WHERE s.is_won) AS won
        FROM leads l LEFT JOIN stages s ON s.id=l.stage_id
       ${lw ? lw + ' AND' : 'WHERE'} l.created_at >= date_trunc('month', now()) - interval '11 months'
       GROUP BY m ORDER BY m`, lp),
    query(`SELECT coalesce(nullif(l.source,''),'Unknown') AS source, count(*) AS cnt FROM leads l ${lw} GROUP BY 1 ORDER BY cnt DESC LIMIT 8`, lp),
    // Field performance: leads, won, spend, CPL, conversion, won value
    query(`
      SELECT coalesce(nullif(l.field,''),'Unknown') AS field,
             count(*) AS leads, count(*) FILTER (WHERE s.is_won) AS won,
             coalesce(sum(l.budget_cents) FILTER (WHERE s.is_won),0) AS won_value_cents,
             coalesce((SELECT sum(amount_cents) FROM expenses x WHERE x.field=l.field),0) AS spend_cents
        FROM leads l LEFT JOIN stages s ON s.id=l.stage_id ${lw}
       GROUP BY l.field ORDER BY leads DESC`, lp),
    query(`SELECT s.name, s.color, s.position, count(l.id) AS cnt FROM stages s LEFT JOIN leads l ON l.stage_id=s.id ${own ? 'AND l.added_by=$1' : ''} GROUP BY s.id ORDER BY s.position`, own ? [req.user.id] : []),
    // Agent leaderboard (hidden for owners/affiliates won't reach here without perm; still guard)
    hideAgent ? Promise.resolve({ rows: [] }) : query(`
      SELECT a.id, a.name, a.commission_cents,
             count(l.id) AS leads, count(l.id) FILTER (WHERE s.is_won) AS won,
             coalesce(sum(l.budget_cents) FILTER (WHERE s.is_won),0) AS won_value_cents
        FROM accounts a LEFT JOIN leads l ON l.agent_id=a.id LEFT JOIN stages s ON s.id=l.stage_id
       WHERE a.account_type='employee'
       GROUP BY a.id ORDER BY won DESC, leads DESC LIMIT 10`),
    query(`SELECT l.priority, count(*) AS cnt FROM leads l ${lw} GROUP BY l.priority`, lp),
    // Budget distribution buckets
    query(`
      SELECT bucket, count(*) AS cnt FROM (
        SELECT CASE
          WHEN budget_cents < 30000000 THEN '< $300k'
          WHEN budget_cents < 60000000 THEN '$300k–600k'
          WHEN budget_cents < 100000000 THEN '$600k–1M'
          WHEN budget_cents < 150000000 THEN '$1M–1.5M'
          ELSE '$1.5M+' END AS bucket
        FROM leads l ${lw}) t GROUP BY bucket`, lp),
    query(`SELECT coalesce(nullif(field,''),'Uncategorised') AS field, coalesce(sum(amount_cents),0) AS spend FROM expenses GROUP BY 1 ORDER BY spend DESC`),
    // Event performance vs target
    query(`
      SELECT e.id, e.name, e.lead_target,
             count(l.id) AS leads, count(l.id) FILTER (WHERE s.is_won) AS won,
             coalesce((SELECT sum(amount_cents) FROM expenses x WHERE x.event_id=e.id),0) AS spend_cents
        FROM events e LEFT JOIN leads l ON l.event_id=e.id LEFT JOIN stages s ON s.id=l.stage_id
       GROUP BY e.id ORDER BY leads DESC`),
    query(`SELECT (SELECT coalesce(sum(amount_cents),0) FROM expenses) AS spend, (SELECT count(*) FROM leads l ${lw}) AS leads`, lp),
  ]);

  const totalSpend = centsToDollars(Number(totals.rows[0].spend));
  const totalLeads = Number(totals.rows[0].leads);

  res.json({
    monthly: monthly.rows.map((r) => ({ label: r.label, count: Number(r.cnt), won: Number(r.won) })),
    sources: sources.rows.map((r) => ({ source: r.source, count: Number(r.cnt) })),
    fields: fields.rows.map((r) => ({
      field: r.field, leads: Number(r.leads), won: Number(r.won),
      wonValue: centsToDollars(Number(r.won_value_cents)),
      spend: centsToDollars(Number(r.spend_cents)),
      cpl: Number(r.leads) ? centsToDollars(Number(r.spend_cents)) / Number(r.leads) : 0,
      conversion: Number(r.leads) ? Number(r.won) / Number(r.leads) : 0,
      roi: Number(r.spend_cents) ? Number(r.won_value_cents) / Number(r.spend_cents) : 0,
    })),
    funnel: funnel.rows.map((r) => ({ name: r.name, color: r.color, count: Number(r.cnt) })),
    leaderboard: leaderboard.rows.map((r) => ({
      id: r.id, name: r.name, leads: Number(r.leads), won: Number(r.won),
      wonValue: centsToDollars(Number(r.won_value_cents)),
      conversion: Number(r.leads) ? Number(r.won) / Number(r.leads) : 0,
    })),
    byPriority: byPriority.rows.map((r) => ({ priority: r.priority, count: Number(r.cnt) })),
    budgetBuckets: budgetBuckets.rows.map((r) => ({ bucket: r.bucket, count: Number(r.cnt) })),
    spendByField: spendByField.rows.map((r) => ({ field: r.field, spend: centsToDollars(Number(r.spend)) })),
    eventPerformance: eventPerf.rows.map((r) => ({
      id: r.id, name: r.name, target: r.lead_target, leads: Number(r.leads), won: Number(r.won),
      spend: centsToDollars(Number(r.spend_cents)),
      attainment: r.lead_target ? Number(r.won) / r.lead_target : 0,
    })),
    summary: { totalSpend, totalLeads, costPerLead: totalLeads ? totalSpend / totalLeads : 0 },
  });
});

export default router;
