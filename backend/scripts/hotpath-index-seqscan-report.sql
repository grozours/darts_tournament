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

DO $$
DECLARE
  issue_count integer := 0;
  has_issue boolean;

BEGIN
  CREATE OR REPLACE FUNCTION pg_temp.report_seq_scan(query_label text, query_sql text)
  RETURNS boolean
  LANGUAGE plpgsql
  AS $func$
  DECLARE
    local_line text;
    local_has_seq_scan boolean := false;
  BEGIN
    FOR local_line IN EXECUTE format('EXPLAIN (ANALYZE, BUFFERS) %s', query_sql)
    LOOP
      IF local_line ILIKE '%Seq Scan%' THEN
        local_has_seq_scan := true;
      END IF;
    END LOOP;

    IF local_has_seq_scan THEN
      RAISE WARNING '[SEQ_SCAN] %', query_label;
      FOR local_line IN EXECUTE format('EXPLAIN (ANALYZE, BUFFERS) %s', query_sql)
      LOOP
        IF local_line ILIKE '%Seq Scan%' OR local_line ILIKE '%Filter:%' OR local_line ILIKE '%Rows Removed by Filter:%' THEN
          RAISE WARNING '  %', local_line;
        END IF;
      END LOOP;
    END IF;

    RETURN local_has_seq_scan;
  END;
  $func$;

  SELECT pg_temp.report_seq_scan(
    'tournaments by status LIVE',
    $$SELECT id, name, status, created_at
      FROM tournaments
      WHERE status = 'LIVE'::tournament_status
      ORDER BY created_at DESC
      LIMIT 20$$
  ) INTO has_issue;
  issue_count := issue_count + CASE WHEN has_issue THEN 1 ELSE 0 END;

  SELECT pg_temp.report_seq_scan(
    'tournaments by status OPEN',
    $$SELECT id, name, status, created_at
      FROM tournaments
      WHERE status = 'OPEN'::tournament_status
      ORDER BY created_at DESC
      LIMIT 20$$
  ) INTO has_issue;
  issue_count := issue_count + CASE WHEN has_issue THEN 1 ELSE 0 END;

  SELECT pg_temp.report_seq_scan(
    'live join graph by tournament_id',
    format($fmt$
      SELECT t.id
      FROM tournaments t
      LEFT JOIN pool_stages ps ON ps.tournament_id = t.id
      LEFT JOIN pools p ON p.pool_stage_id = ps.id
      LEFT JOIN brackets b ON b.tournament_id = t.id
      LEFT JOIN matches m ON m.tournament_id = t.id
      LEFT JOIN targets tg ON tg.tournament_id = t.id
      WHERE t.id = %s
      LIMIT 1
    $fmt$, :'tournament_id')
  ) INTO has_issue;
  issue_count := issue_count + CASE WHEN has_issue THEN 1 ELSE 0 END;

  SELECT pg_temp.report_seq_scan(
    'matches by bracket_id',
    format($fmt$
      SELECT id, bracket_id, status
      FROM matches
      WHERE bracket_id = %s
      ORDER BY created_at DESC
      LIMIT 50
    $fmt$, :'bracket_id')
  ) INTO has_issue;
  issue_count := issue_count + CASE WHEN has_issue THEN 1 ELSE 0 END;

  SELECT pg_temp.report_seq_scan(
    'matches by target_id',
    format($fmt$
      SELECT id, target_id, status
      FROM matches
      WHERE target_id = %s
      ORDER BY created_at DESC
      LIMIT 50
    $fmt$, :'target_id')
  ) INTO has_issue;
  issue_count := issue_count + CASE WHEN has_issue THEN 1 ELSE 0 END;

  SELECT pg_temp.report_seq_scan(
    'scheduled_matches by target_id',
    format($fmt$
      SELECT id, target_id, scheduled_time
      FROM scheduled_matches
      WHERE target_id = %s
      ORDER BY scheduled_time DESC
      LIMIT 50
    $fmt$, :'target_id')
  ) INTO has_issue;
  issue_count := issue_count + CASE WHEN has_issue THEN 1 ELSE 0 END;

  SELECT pg_temp.report_seq_scan(
    'pool_stages by status IN_PROGRESS',
    $$SELECT id, status
      FROM pool_stages
      WHERE status = 'IN_PROGRESS'::stage_status
      ORDER BY created_at DESC
      LIMIT 50$$
  ) INTO has_issue;
  issue_count := issue_count + CASE WHEN has_issue THEN 1 ELSE 0 END;

  SELECT pg_temp.report_seq_scan(
    'pools by status IN_PROGRESS',
    $$SELECT id, status
      FROM pools
      WHERE status = 'IN_PROGRESS'::pool_status
      ORDER BY created_at DESC
      LIMIT 50$$
  ) INTO has_issue;
  issue_count := issue_count + CASE WHEN has_issue THEN 1 ELSE 0 END;

  SELECT pg_temp.report_seq_scan(
    'brackets by status IN_PROGRESS',
    $$SELECT id, status
      FROM brackets
      WHERE status = 'IN_PROGRESS'::bracket_status
      ORDER BY created_at DESC
      LIMIT 50$$
  ) INTO has_issue;
  issue_count := issue_count + CASE WHEN has_issue THEN 1 ELSE 0 END;

  SELECT pg_temp.report_seq_scan(
    'targets by status IN_USE',
    $$SELECT id, status
      FROM targets
      WHERE status = 'IN_USE'::target_status
      ORDER BY target_number ASC
      LIMIT 50$$
  ) INTO has_issue;
  issue_count := issue_count + CASE WHEN has_issue THEN 1 ELSE 0 END;

  IF issue_count = 0 THEN
    RAISE NOTICE '[OK] No Seq Scan detected on the tested hot queries.';
  ELSE
    RAISE WARNING '[SUMMARY] % query pattern(s) with Seq Scan detected.', issue_count;
  END IF;
END $$;
