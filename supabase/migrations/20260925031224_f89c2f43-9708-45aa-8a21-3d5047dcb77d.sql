CREATE OR REPLACE FUNCTION public.consume_qr_session_job(_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_count integer;
BEGIN
  UPDATE public.qr_sessions SET jobs_used = jobs_used + 1
   WHERE id = _session_id AND status = 'ACTIVE' AND expires_at > now() AND jobs_used < max_jobs;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END; $$;
REVOKE EXECUTE ON FUNCTION public.consume_qr_session_job(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_qr_session_job(uuid) TO service_role;