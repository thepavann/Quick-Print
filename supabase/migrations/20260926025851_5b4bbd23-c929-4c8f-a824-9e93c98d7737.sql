ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS file_purged_at timestamptz;

CREATE INDEX IF NOT EXISTS print_jobs_purge_idx
  ON public.print_jobs (completed_at)
  WHERE file_purged_at IS NULL;