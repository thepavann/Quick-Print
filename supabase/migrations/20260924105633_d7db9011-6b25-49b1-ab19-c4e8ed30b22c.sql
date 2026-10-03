ALTER TABLE public.qr_sessions ADD COLUMN IF NOT EXISTS claimed_at timestamptz, ADD COLUMN IF NOT EXISTS claim_hash text;
DROP INDEX IF EXISTS public.qr_sessions_one_active_per_station;
CREATE UNIQUE INDEX qr_sessions_one_active_per_station ON public.qr_sessions (station_id) WHERE status = 'ACTIVE' AND claimed_at IS NULL;