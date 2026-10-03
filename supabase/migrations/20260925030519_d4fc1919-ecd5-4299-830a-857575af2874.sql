CREATE OR REPLACE FUNCTION public.requeue_stale_downloading_jobs(_station_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  UPDATE public.print_jobs SET status='QUEUED', claimed_by=NULL, claimed_at=NULL
   WHERE station_id=_station_id AND status='DOWNLOADING' AND claimed_at < now() - interval '5 minutes' AND attempts < 3;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;
REVOKE EXECUTE ON FUNCTION public.requeue_stale_downloading_jobs(uuid) FROM PUBLIC, anon, authenticated;