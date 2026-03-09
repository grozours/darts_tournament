# DB Perf Checklist

This checklist is focused on validating Prisma/PostgreSQL hot paths with real query plans.

## 1) Prerequisites

- Run commands from `backend/` so `.env` is loaded correctly.
- Ensure local DB is up and migrations are applied.
- Use PostgreSQL with statistics enabled (default).

## 2) Quick Baseline

Run these once before deep analysis:

```bash
cd backend
node -e "require('dotenv').config(); const { Client } = require('pg'); (async()=>{ const c=new Client({connectionString:process.env.DATABASE_URL}); await c.connect(); const r=await c.query('SELECT now() as now, version() as version'); console.log(r.rows[0]); await c.end(); })().catch(e=>{console.error(e); process.exit(1);});"
```

## 3) Explain Analyze Queries (High Priority)

Use production-like parameters when possible.

### A. Active participants list (players hot path)

Maps to `getParticipants` and related checks.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, person_id, first_name, last_name, surname, team_name, email, phone, skill_level, registered_at, checked_in
FROM players
WHERE tournament_id = 'TOURNAMENT_ID' AND is_active = true
ORDER BY registered_at ASC;
```

### B. Participant count and checked-in count

Maps to `getParticipantCount` and `getCheckedInCount`.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM players
WHERE tournament_id = 'TOURNAMENT_ID' AND is_active = true;

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM players
WHERE tournament_id = 'TOURNAMENT_ID' AND is_active = true AND checked_in = true;
```

### C. Bracket matches by round + ordering

Maps to bracket round endpoints.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM matches
WHERE bracket_id = 'BRACKET_ID' AND round_number = 1
ORDER BY match_number ASC;
```

### D. Live summary by status + recency

Maps to live summary core handler.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id
FROM tournaments
WHERE status IN ('LIVE', 'OPEN')
ORDER BY created_at DESC
LIMIT 100;
```

### E. Text search (trigram indexes)

Maps to group/player search with `contains` + case-insensitive behavior.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, first_name, last_name, surname, team_name
FROM players
WHERE tournament_id = 'TOURNAMENT_ID'
  AND is_active = true
  AND (
    lower(first_name) LIKE '%alex%'
    OR lower(last_name) LIKE '%alex%'
    OR lower(surname) LIKE '%alex%'
    OR lower(team_name) LIKE '%alex%'
  )
ORDER BY first_name ASC, last_name ASC
LIMIT 30;
```

## 4) What Good Looks Like

- Planner uses `Index Scan`, `Bitmap Index Scan`, or `Index Only Scan` on expected indexes.
- `Buffers: shared hit` dominates over `shared read` after warmup.
- No large `Seq Scan` on high-cardinality tables (`players`, `matches`) for hot endpoints.
- Sort cost is small for bracket round query due to index ordering.

## 5) Red Flags

- `Seq Scan on players` for participant count/list queries.
- `Sort Method: external merge` on bracket query.
- High `Rows Removed by Filter` with little index usage.
- Trigram search still doing full table scans on common terms.

## 6) Next Actions If Red Flags Appear

- Add/adjust partial indexes for `players` active rows.
- Consider `INCLUDE` indexes for read-heavy match projections.
- Tighten query projections (`select`) to reduce heap fetches.
- Re-run explain plans and compare total time and buffer usage.

## 7) Optional: Capture Plan via Node Script

```bash
cd backend
node - <<'NODE'
const { Client } = require('pg');
require('dotenv').config();

const query = `
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM matches
WHERE bracket_id = 'BRACKET_ID' AND round_number = 1
ORDER BY match_number ASC;
`;

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(query);
  console.log(rows.map(r => r['QUERY PLAN']).join('\n'));
  await client.end();
})();
NODE
```
