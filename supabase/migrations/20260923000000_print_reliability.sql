-- Reliability and storage setup for QuickPrint.
-- The application uses service_role for server-side Storage operations, while
-- signed upload URLs keep the private PDF bucket inaccessible to students.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'print-files',
  'print-files',
  false,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Clean up any duplicate active sessions created by older versions before
-- enforcing the one-active-session invariant.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY station_id ORDER BY created_at DESC) AS rn
  FROM public.qr_sessions
  WHERE status = 'ACTIVE' AND expires_at > now()
)
UPDATE public.qr_sessions
   SET status = 'EXPIRED'
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Only one live QR session may exist per station. This prevents two counter-display
-- requests from creating competing QR codes during a rotation.
CREATE UNIQUE INDEX IF NOT EXISTS qr_sessions_one_active_per_station
  ON public.qr_sessions (station_id)
  WHERE status = 'ACTIVE';

-- Atomically consume one QR-session job slot. This closes the race where two
-- phones could both observe the same jobs_used value and exceed max_jobs.
CREATE OR REPLACE FUNCTION public.consume_qr_session_job(_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.qr_sessions
     SET jobs_used = jobs_used + 1
   WHERE id = _session_id
     AND status = 'ACTIVE'
     AND expires_at > now()
     AND jobs_used < max_jobs;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_qr_session_job(uuid) FROM anon, authenticated, PUBLIC;

-- A claimed job can become stuck if the counter PC loses power while the PDF
-- is downloading. Allow a later agent poll to recover those jobs safely.
CREATE OR REPLACE FUNCTION public.requeue_stale_downloading_jobs(_station_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.print_jobs
     SET status = 'QUEUED',
         claimed_by = NULL,
         claimed_at = NULL,
         error_message = NULL
   WHERE station_id = _station_id
     AND status = 'DOWNLOADING'
     AND claimed_at < now() - interval '10 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.requeue_stale_downloading_jobs(uuid) FROM anon, authenticated, PUBLIC;
