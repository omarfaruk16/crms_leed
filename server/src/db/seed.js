// Seeds roles, stages, accounts (admin/owner/employee/affiliate), events,
// expenses, leads (with field + expense attribution) & activities.
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from './pool.js';
import { ALL_PERMISSIONS, permissionsFromList } from '../utils/permissions.js';

const FIELDS = ['Google Ads', 'Facebook', 'Instagram', 'Walk-in', 'Referral', 'Property Portal', 'Cold Call', 'TikTok'];
const FIRST = ['Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas', 'Mia', 'Aiden', 'Charlotte', 'Omar', 'Layla', 'Yusuf', 'Aisha', 'Daniel', 'Grace', 'Hassan'];
const LAST = ['Bennett', 'Carter', 'Hughes', 'Patel', 'Khan', 'Reyes', 'Morgan', 'Foster', 'Nguyen', 'Silva', 'Ahmed', 'Brooks', 'Ward', 'Diaz', 'Hayes'];
const AREAS = ['Marina District', 'Old Town', 'Riverside', 'Hilltop', 'Garden City', 'Seaview', 'Downtown', 'Lakeside'];

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const daysAgo = (d) => new Date(Date.now() - d * 86400000);
const daysAhead = (d) => new Date(Date.now() + d * 86400000);
const dateStr = (d) => d.toISOString().slice(0, 10);

async function seed() {
  console.log('Seeding…');
  await withTransaction(async (c) => {
    await c.query('TRUNCATE activities, leads, expenses, event_owners, events, accounts, stages, roles RESTART IDENTITY CASCADE');

    // ---- Roles ----
    const roles = {};
    const roleDefs = [
      ['Administrator', 'Full access to everything', true, ALL_PERMISSIONS],
      ['Manager', 'Manages leads, events, expenses and agents', true, permissionsFromList(['canAddLead', 'canEditLead', 'canDeleteLead', 'canAssignLead', 'canImportExport', 'canManageEvents', 'canManageExpenses', 'canSeeAgents', 'canViewAnalytics'])],
      ['Agent', 'Works the leads assigned to them', true, permissionsFromList(['canAddLead', 'canEditLead', 'canManageEvents', 'canSeeAgents'])],
      ['Owner', 'Read-only oversight across events (no agent identities)', true, permissionsFromList(['canViewAnalytics'])],
      ['Affiliate', 'Adds qualified leads, earns per won lead', true, permissionsFromList(['canAddLead'])],
    ];
    for (const [name, desc, sys, perms] of roleDefs) {
      const { rows } = await c.query(
        'INSERT INTO roles (name, description, is_system, permissions) VALUES ($1,$2,$3,$4) RETURNING id',
        [name, desc, sys, JSON.stringify(perms)]
      );
      roles[name] = rows[0].id;
    }

    // ---- Stages (Qualified marked as affiliate minimum) ----
    const stageDefs = [
      ['New', '#4A6FA5', 0, false, false, false],
      ['Contacted', '#2F7E7E', 1, false, false, false],
      ['Qualified', '#6B5B95', 2, false, false, true],
      ['Viewing', '#C0703B', 3, false, false, false],
      ['Negotiation', '#B7791F', 4, false, false, false],
      ['Won', '#3E7C57', 5, true, false, false],
      ['Lost', '#A14B4B', 6, false, true, false],
    ];
    const stages = [];
    for (const [name, color, pos, won, lost, affMin] of stageDefs) {
      const { rows } = await c.query(
        'INSERT INTO stages (name, color, position, is_won, is_lost, is_affiliate_min) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, is_won, is_lost, position',
        [name, color, pos, won, lost, affMin]
      );
      stages.push(rows[0]);
    }

    // ---- Accounts ----
    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const accounts = [];
    const accDefs = [
      ['Sky Root Admin', 'admin@skyroot.com', 'admin123', 'admin', 'Administrator', 'Sky Root Properties Ltd.', 0],
      ['Olivia Bennett', 'olivia@skyroot.com', 'manager123', 'employee', 'Manager', 'Sky Root Properties Ltd.', 0],
      ['Liam Carter', 'liam@skyroot.com', 'agent123', 'employee', 'Agent', 'Sky Root Properties Ltd.', 0],
      ['Emma Hughes', 'emma@skyroot.com', 'agent123', 'employee', 'Agent', 'Sky Root Properties Ltd.', 0],
      ['Noah Patel', 'noah@skyroot.com', 'agent123', 'employee', 'Agent', 'Sky Root Properties Ltd.', 0],
      ['Grace Morgan', 'owner@skyroot.com', 'owner123', 'owner', 'Owner', 'Sky Root Holdings', 0],
      ['Hassan Ahmed', 'affiliate@partners.com', 'affiliate123', 'affiliate', 'Affiliate', 'Bright Realty Partners', 25000], // $250 / won lead
      ['Aisha Khan', 'aisha@partners.com', 'affiliate123', 'affiliate', 'Affiliate', 'Skyline Affiliates', 30000],
    ];
    for (const [name, email, pw, type, role, company, comm] of accDefs) {
      const { rows } = await c.query(
        `INSERT INTO accounts (name, email, password_hash, account_type, role_id, company, commission_cents)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, account_type`,
        [name, email, hash(pw), type, roles[role], company, comm]
      );
      accounts.push(rows[0]);
    }
    const admin = accounts[0];
    const employees = accounts.filter((a) => a.account_type === 'employee');
    const owners = accounts.filter((a) => a.account_type === 'owner');
    const affiliates = accounts.filter((a) => a.account_type === 'affiliate');

    // ---- Events ----
    const events = [];
    const eventDefs = [
      ['Summer Showcase', 'Open-house weekend across flagship listings', 'Seaview', daysAhead(20), 120],
      ['Q3 Digital Push', 'Performance campaign for downtown apartments', 'Downtown', daysAgo(10), 200],
      ['Investor Mixer', 'Networking evening for high-net-worth buyers', 'Marina District', daysAhead(45), 60],
    ];
    for (const [name, desc, loc, date, target] of eventDefs) {
      const { rows } = await c.query(
        'INSERT INTO events (name, description, location, event_date, lead_target) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [name, desc, loc, dateStr(date), target]
      );
      events.push(rows[0].id);
      // every owner is linked to every event in the demo
      for (const o of owners) await c.query('INSERT INTO event_owners (event_id, account_id) VALUES ($1,$2)', [rows[0].id, o.id]);
    }

    // ---- Expenses (top-level, by field, with date ranges; some event-linked) ----
    const expenses = [];
    const expDefs = [
      ['Google Search Ads', 'Branded + non-branded keywords', 'Google Ads', 18000, daysAgo(40), daysAgo(10), events[1]],
      ['Google Search Ads', 'Retargeting display', 'Google Ads', 6000, daysAgo(20), daysAhead(5), events[1]],
      ['Facebook Lead Forms', 'Carousel + lead form campaign', 'Facebook', 12000, daysAgo(35), daysAgo(5), null],
      ['Instagram Reels', 'Influencer collaboration', 'Instagram', 9000, daysAgo(30), daysAhead(2), null],
      ['Property Portal Listing', 'Featured listing fees', 'Property Portal', 4000, daysAgo(60), daysAhead(30), null],
      ['Summer Showcase Venue', 'Venue hire + catering', 'Event', 15000, daysAhead(18), daysAhead(22), events[0]],
      ['TikTok Spark Ads', 'Short-form video boost', 'TikTok', 5000, daysAgo(15), daysAhead(10), null],
    ];
    for (const [title, desc, field, amt, from, to, evId] of expDefs) {
      const { rows } = await c.query(
        `INSERT INTO expenses (title, description, field, amount_cents, period_from, period_to, event_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, field`,
        [title, desc, field, amt * 100, dateStr(from), dateStr(to), evId, admin.id]
      );
      expenses.push(rows[0]);
    }

    // ---- Leads ----
    const TAGS = ['VIP', 'Cash buyer', 'Investor', 'First-time', 'Hot', 'Relocating', 'Family', 'Downsizing'];
    const N = 280;
    const values = [];
    const params = [];
    let p = 0;
    for (let i = 0; i < N; i++) {
      const name = `${rand(FIRST)} ${rand(LAST)}`;
      const stage = rand(stages);
      // ~20% of leads come from affiliates (qualified+), rest from employees
      const fromAffiliate = Math.random() < 0.2;
      const adder = fromAffiliate ? rand(affiliates) : admin;
      const agent = fromAffiliate ? null : rand(employees);
      // attribute to an expense (and inherit its field) most of the time
      const exp = Math.random() < 0.75 ? rand(expenses) : null;
      const field = exp ? exp.field : rand(FIELDS);
      const created = daysAgo(randInt(0, 175));
      const tags = [...new Set([rand(TAGS), Math.random() > 0.6 ? rand(TAGS) : null].filter(Boolean))];
      const open = !stage.is_won && !stage.is_lost;
      const followAt = open && Math.random() > 0.4 ? daysAhead(randInt(-2, 6)) : null;
      const wonAt = stage.is_won ? daysAgo(randInt(0, 60)) : null;
      const row = [
        name,
        `+1 415-555-${String(randInt(1000, 9999))}`,
        `${name.toLowerCase().replace(/[^a-z]/g, '.')}${i}@email.com`,
        `${randInt(1, 400)} ${rand(['Main', 'Oak', 'Palm', 'Cedar'])} St, ${rand(AREAS)}`,
        randInt(150, 2400) * 1000 * 100,
        field,
        rand(['Website form', 'Phone enquiry', 'Walk-in', 'Portal lead', 'Referral']),
        randInt(5, 98),
        rand(['low', 'medium', 'high']),
        tags,
        stage.id,
        agent ? agent.id : null,
        Math.random() > 0.45 ? rand(events) : (exp ? null : null),
        exp ? exp.id : null,
        adder.id,
        followAt,
        wonAt,
        created,
      ];
      values.push(`(${row.map(() => `$${++p}`).join(',')})`);
      params.push(...row);
    }
    const { rows: leadRows } = await c.query(
      `INSERT INTO leads
        (name, phone, email, address, budget_cents, field, source, score, priority, tags,
         stage_id, agent_id, event_id, expense_id, added_by, follow_up_at, won_at, created_at)
       VALUES ${values.join(',')}
       RETURNING id, agent_id, added_by`,
      params
    );

    // ---- Activities ----
    const types = ['call', 'email', 'whatsapp', 'note', 'viewing'];
    const notes = [
      'Left voicemail, will retry tomorrow.',
      'Sent brochure for the Seaview listing.',
      'Booked a viewing for Saturday 11am.',
      'Discussed budget — flexible up to 1.8M.',
      'Following up after the open house.',
      'Very interested, awaiting mortgage pre-approval.',
    ];
    const aVals = [];
    const aParams = [];
    let ap = 0;
    for (const l of leadRows) {
      for (let k = 0, n = randInt(1, 4); k < n; k++) {
        const row = [l.id, l.agent_id || l.added_by, rand(types), rand(notes), daysAgo(randInt(0, 30))];
        aVals.push(`($${++ap},$${++ap},$${++ap},$${++ap},$${++ap})`);
        aParams.push(...row);
      }
    }
    await c.query(`INSERT INTO activities (lead_id, account_id, type, body, created_at) VALUES ${aVals.join(',')}`, aParams);

    console.log(`✓ ${roleDefs.length} roles · ${stageDefs.length} stages · ${accDefs.length} accounts · ${eventDefs.length} events · ${expDefs.length} expenses · ${N} leads · ${aVals.length} activities`);
  });

  await pool.query('ANALYZE leads, activities, expenses');
}

try {
  await seed();
  console.log('\nDemo logins:');
  console.log('  admin@skyroot.com      / admin123       (Admin)');
  console.log('  olivia@skyroot.com     / manager123     (Employee · Manager)');
  console.log('  liam@skyroot.com       / agent123       (Employee · Agent)');
  console.log('  owner@skyroot.com      / owner123       (Owner)');
  console.log('  affiliate@partners.com / affiliate123   (Affiliate)');
  process.exit(0);
} catch (err) {
  console.error('Seed failed:', err);
  process.exit(1);
}
