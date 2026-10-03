
ALTER TABLE public.printers
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS default_paper public.paper_size NOT NULL DEFAULT 'A4',
  ADD COLUMN IF NOT EXISTS supports_color boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supports_duplex boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz;

ALTER TABLE public.agent_devices
  ADD COLUMN IF NOT EXISTS hostname text,
  ADD COLUMN IF NOT EXISTS agent_version text,
  ADD COLUMN IF NOT EXISTS reported_printer_name text,
  ADD COLUMN IF NOT EXISTS reported_printer_status text;

ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'COUNTER_CASH';

UPDATE public.printers SET model = 'HP LaserJet Pro M404dn' WHERE model IS NULL;

/*
 * Atomic FIFO claim. A single UPDATE ... WHERE status='QUEUED' picked by the
 * oldest queued row guarantees only one agent can ever move a given job out of
 * the queue, even when several agents poll at the same moment.
 */
CREATE OR REPLACE FUNCTION public.claim_next_print_job(_station_id uuid, _agent_id uuid, _job_id uuid DEFAULT NULL)
RETURNS public.print_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed public.print_jobs;
BEGIN
  UPDATE public.print_jobs j
     SET status = 'DOWNLOADING',
         claimed_by = _agent_id,
         claimed_at = now(),
         started_at = COALESCE(j.started_at, now()),
         attempts = j.attempts + 1
   WHERE j.id = (
     SELECT c.id FROM public.print_jobs c
      WHERE c.station_id = _station_id
        AND c.status = 'QUEUED'
        AND (_job_id IS NULL OR c.id = _job_id)
      ORDER BY c.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
   )
  RETURNING j.* INTO claimed;

  RETURN claimed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_next_print_job(uuid, uuid, uuid) FROM anon, authenticated, PUBLIC;

ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.printers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_devices;
