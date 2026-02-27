\set ON_ERROR_STOP on

\if :{?tournament_id}
\else
\set tournament_id '00000000-0000-0000-0000-000000000000'
\endif

\if :{?bracket_id}
\else
\set bracket_id '00000000-0000-0000-0000-000000000000'
\endif

\if :{?target_id}
\else
\set target_id '00000000-0000-0000-0000-000000000000'
\endif

\if :{?pool_stage_id}
\else
\set pool_stage_id '00000000-0000-0000-0000-000000000000'
\endif

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'tournaments',
    'pool_stages',
    'pools',
    'brackets',
    'targets',
    'matches',
    'scheduled_matches',
    'bracket_targets'
  )
ORDER BY tablename, indexname;

SELECT relname AS table_name, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN (
    'tournaments',
    'pool_stages',
    'pools',
    'brackets',
    'targets',
    'matches',
    'scheduled_matches',
    'bracket_targets'
  )
ORDER BY relname;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, status, created_at
FROM tournaments
WHERE status = 'LIVE'::tournament_status
ORDER BY created_at DESC
LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, status, created_at
FROM tournaments
WHERE status = 'OPEN'::tournament_status
ORDER BY created_at DESC
LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT t.id
FROM tournaments t
LEFT JOIN pool_stages ps ON ps.tournament_id = t.id
LEFT JOIN pools p ON p.pool_stage_id = ps.id
LEFT JOIN brackets b ON b.tournament_id = t.id
LEFT JOIN matches m ON m.tournament_id = t.id
LEFT JOIN targets tg ON tg.tournament_id = t.id
WHERE t.id = :'tournament_id'
LIMIT 1;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, bracket_id, status
FROM matches
WHERE bracket_id = :'bracket_id'
ORDER BY created_at DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, target_id, status
FROM matches
WHERE target_id = :'target_id'
ORDER BY created_at DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, target_id, scheduled_time
FROM scheduled_matches
WHERE target_id = :'target_id'
ORDER BY scheduled_time DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status
FROM pool_stages
WHERE status = 'IN_PROGRESS'::stage_status
ORDER BY created_at DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status
FROM pools
WHERE status = 'IN_PROGRESS'::pool_status
ORDER BY created_at DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status
FROM brackets
WHERE status = 'IN_PROGRESS'::bracket_status
ORDER BY created_at DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status
FROM targets
WHERE status = 'IN_USE'::target_status
ORDER BY target_number ASC
LIMIT 50;