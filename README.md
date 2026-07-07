# Sky Root Properties CRM

A full-stack real-estate lead-management CRM — **React + Tailwind** frontend, **Node/Express** API, **PostgreSQL** database, fully **Dockerized**.

## Quick start (Docker — recommended)

```bash
docker compose up --build
```

Then open **http://localhost:8080**. The API runs on `:4000`, Postgres on `:5433`.
On first boot the database schema is applied and demo data is seeded automatically.

### Demo logins

| Email | Password | Account type |
|---|---|---|
| `admin@skyroot.com` | `admin123` | Admin — full access |
| `olivia@skyroot.com` | `manager123` | Employee · Manager |
| `liam@skyroot.com` | `agent123` | Employee · Agent |
| `owner@skyroot.com` | `owner123` | Owner — sees all leads, no agent identities |
| `affiliate@partners.com` | `affiliate123` | Affiliate partner — own leads + income |

To wipe and reseed: `docker compose down -v && docker compose up --build`.

## Local development (without Docker)

Requires Node 20+ and a local PostgreSQL.

```bash
# API
cd server
cp .env.example .env          # set PGUSER etc. to your local Postgres
npm install
npm run db:reset              # create db + schema + seed
npm run dev                   # http://localhost:4000

# Web (separate terminal)
cd client
npm install
npm run dev                   # http://localhost:5173 (proxies /api -> :4000)
```

## Account types & visibility

| Type | Can do | Lead visibility |
|---|---|---|
| **Admin** | Everything: create/delete any account, reset passwords, manage stages, roles, events, expenses | All leads + agents |
| **Employee** | Work/add/edit leads, events, log activity (role-gated) | All leads + agents |
| **Owner** | Read-only oversight of linked events, leads, expenses & analytics | All leads, **agent/employee identity hidden** |
| **Affiliate** | Add leads (stage ≥ **Qualified**), earn commission per won lead | Only leads they added; dashboard shows **total income** |

All accounts are created **internally from the admin panel**. Passwords are set/changed by the admin (and users can change their own via the API).

## Features

- **Dashboard** — KPIs, lead trend, pipeline donut, leads-by-field, cost-per-lead, follow-ups (48h), recent activity; affiliate income banner.
- **Leads** — table + kanban board, fast search/filter (stage, agent, field, event, expense, tag, priority), sort, bulk actions, drag-to-restage, CSV import/export, photo upload, conversation log, follow-up via calendar, **expense attribution** ("which expense brought this lead").
- **Events** — name, description, successful-lead target, **cover image upload**, linked owners, pipeline breakdown, expenses.
- **Expenses** — top-level page: `title, description, field, amount, period (from→to)`, optional event link; spend by field/title charts; one title can hold many rows; every lead can be attributed to an expense → true cost-per-lead.
- **Analytics** — date-ranged; leads vs won trend, sources, field performance (spend/CPL/conversion/ROI), funnel, budget distribution, priority mix, spend-by-field, event attainment, agent leaderboard.
- **Admin** — accounts (4 types) with avatar upload, roles & custom permissions, pipeline stage management (rename/recolour/flag Won·Lost·Min-affiliate), admin password resets.

## Architecture

```
client/   React + Vite + Tailwind + Recharts → built & served by nginx (proxies /api, /uploads)
server/   Express API, JWT auth, role + account-type permissions, multer uploads
          src/db/schema.sql  — indexed, money-as-cents, GIN/trigram/partial indexes
docker-compose.yml  — postgres + api + web
```

### Performance

The schema is tuned for large datasets: UUID PKs generated in-DB, money stored as `BIGINT` cents, and composite / partial / GIN / trigram indexes on every hot query path (lead filters, board, follow-up windows, tag arrays, fuzzy name/email search). A shared pooled connection with slow-query logging backs the API.
