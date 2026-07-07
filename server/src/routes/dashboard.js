import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';
import { centsToDollars } from '../utils/serialize.js';
import { scopeForAccountType } from '../utils/permissions.js';

const router = Router();
router.use(authRequired);

// GET /api/dashboard — KPIs, follow-ups, pipeline, field metrics, recent activity.
// Scope:  affiliate -> own leads + income ;  owner -> all leads, agent hidden.
router.get('/', async (req, res) => {
  const sc = scopeForAccountType(req.user.account_type);
  const own = sc === 'own';
  const hideAgent = sc === 'all_no_agent';
  // every lead-touching query gets the same optional "added_by = me" filter
  const f = own ? 'AND l.added_by = $1' : '';
  const p = own ? [req.user.id] : [];

  const [kpis, fields, followups, pipeline, recent, trend, income] = await Promise.all([
    query(`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE s.is_won) AS won,
        count(*) FILTER (WHERE s.is_lost) AS lost,
        count(*) FILTER (WHERE NOT s.is_won AND NOT s.is_lost) AS open,
        count(*) FILTER (WHERE l.follow_up_at BETWEEN now() AND now() + interval '48 hours') AS due_soon,
        count(*) FILTER (WHERE l.follow_up_at < now() AND NOT s.is_won AND NOT s.is_lost) AS overdue,
        coalesce(sum(l.budget_cents),0) AS pipeline_value,
        coalesce(sum(l.budget_cents) FILTER (WHERE s.is_won),0) AS won_value,
        count(*) FILTER (WHERE l.created_at >= now() - interval '30 days') AS new_30d
      FROM leads l LEFT JOIN stages s ON s.id=l.stage_id WHERE TRUE ${f}`, p),
    // Leads by field + spend + cost-per-lead (spend matched on field name)
    query(`
      SELECT coalesce(nullif(l.field,''),'Unknown') AS field,
             count(*) AS leads,
             count(*) FILTER (WHERE s.is_won) AS won,
             coalesce((SELECT sum(amount_cents) FROM expenses x WHERE x.field = l.field),0) AS spend_cents
        FROM leads l LEFT JOIN stages s ON s.id=l.stage_id
       WHERE TRUE ${f}
       GROUP BY l.field ORDER BY leads DESC`, p),
    query(`
      SELECT l.id, l.name, l.follow_up_at, s.name AS stage_name, s.color AS stage_color, ag.name AS agent_name
        FROM leads l LEFT JOIN stages s ON s.id=l.stage_id LEFT JOIN accounts ag ON ag.id=l.agent_id
       WHERE l.follow_up_at IS NOT NULL AND l.follow_up_at <= now() + interval '48 hours' ${f}
       ORDER BY l.follow_up_at ASC LIMIT 12`, p),
    query(`
      SELECT s.id, s.name, s.color, s.position, count(l.id) ${own ? 'FILTER (WHERE l.added_by = $1)' : ''} AS lead_count,
             coalesce(sum(l.budget_cents) ${own ? 'FILTER (WHERE l.added_by = $1)' : ''},0) AS value_cents
        FROM stages s LEFT JOIN leads l ON l.stage_id=s.id GROUP BY s.id ORDER BY s.position`, own ? [req.user.id] : []),
    query(`
      SELECT ac.type, ac.body, ac.created_at, a.name AS who, l.name AS lead_name, l.id AS lead_id
        FROM activities ac JOIN leads l ON l.id=ac.lead_id LEFT JOIN accounts a ON a.id=ac.account_id
       WHERE TRUE ${own ? 'AND l.added_by = $1' : ''}
       ORDER BY ac.created_at DESC LIMIT 15`, own ? [req.user.id] : []),
    // 6-month new-lead trend
    query(`
      SELECT to_char(date_trunc('month', l.created_at),'Mon') AS label, date_trunc('month', l.created_at) AS m, count(*) AS cnt
        FROM leads l WHERE l.created_at >= date_trunc('month', now()) - interval '5 months' ${f}
       GROUP BY m ORDER BY m`, p),
    // affiliate income: won leads * their commission
    own
      ? query(`SELECT count(*) FILTER (WHERE s.is_won) AS won, count(*) AS total
                 FROM leads l JOIN stages s ON s.id=l.stage_id WHERE l.added_by=$1`, [req.user.id])
      : Promise.resolve({ rows: [{ won: 0, total: 0 }] }),
  ]);

  const k = kpis.rows[0];
  const totalSpendCents = (await query('SELECT coalesce(sum(amount_cents),0) c FROM expenses')).rows[0].c;
  const costPerLead = Number(k.total) ? centsToDollars(Number(totalSpendCents)) / Number(k.total) : 0;

  let affiliate = null;
  if (req.user.account_type === 'affiliate') {
    const won = Number(income.rows[0].won);
    affiliate = {
      myLeads: Number(income.rows[0].total),
      wonLeads: won,
      incomePerLead: req.user.commission_cents / 100,
      totalIncome: (req.user.commission_cents * won) / 100,
    };
  }

  res.json({
    accountType: req.user.account_type,
    kpis: {
      totalLeads: Number(k.total),
      openLeads: Number(k.open),
      wonLeads: Number(k.won),
      lostLeads: Number(k.lost),
      winRate: Number(k.total) ? Number(k.won) / Number(k.total) : 0,
      dueSoon: Number(k.due_soon),
      overdue: Number(k.overdue),
      new30d: Number(k.new_30d),
      pipelineValue: centsToDollars(Number(k.pipeline_value)),
      wonValue: centsToDollars(Number(k.won_value)),
      totalSpend: centsToDollars(Number(totalSpendCents)),
      costPerLead,
    },
    affiliate,
    fields: fields.rows.map((r) => ({
      field: r.field, leads: Number(r.leads), won: Number(r.won),
      spend: centsToDollars(Number(r.spend_cents)),
      costPerLead: Number(r.leads) ? centsToDollars(Number(r.spend_cents)) / Number(r.leads) : 0,
      conversion: Number(r.leads) ? Number(r.won) / Number(r.leads) : 0,
    })),
    followups: followups.rows.map((r) => ({ id: r.id, name: r.name, followUpAt: r.follow_up_at, stageName: r.stage_name, stageColor: r.stage_color, agentName: hideAgent ? null : r.agent_name })),
    pipeline: pipeline.rows.map((r) => ({ id: r.id, name: r.name, color: r.color, count: Number(r.lead_count), value: centsToDollars(Number(r.value_cents)) })),
    recent: recent.rows.map((r) => ({ type: r.type, body: r.body, who: hideAgent ? null : r.who, leadName: r.lead_name, leadId: r.lead_id, when: r.created_at })),
    trend: trend.rows.map((r) => ({ label: r.label, count: Number(r.cnt) })),
  });
});

export default router;
