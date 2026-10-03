
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.owns_station(_station uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stations s
    WHERE s.id = _station
      AND (s.owner_id = auth.uid() OR private.has_role(auth.uid(),'ADMIN'))
  );
$$;

DROP POLICY "owner manages station" ON public.stations;
CREATE POLICY "owner manages station" ON public.stations FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR private.has_role(auth.uid(),'ADMIN'))
  WITH CHECK (owner_id = auth.uid() OR private.has_role(auth.uid(),'ADMIN'));

DROP POLICY "owner manages printers" ON public.printers;
CREATE POLICY "owner manages printers" ON public.printers FOR ALL TO authenticated
  USING (private.owns_station(station_id)) WITH CHECK (private.owns_station(station_id));

DROP POLICY "owner manages agents" ON public.agent_devices;
CREATE POLICY "owner manages agents" ON public.agent_devices FOR ALL TO authenticated
  USING (private.owns_station(station_id)) WITH CHECK (private.owns_station(station_id));

DROP POLICY "owner manages pricing" ON public.pricing_rules;
CREATE POLICY "owner manages pricing" ON public.pricing_rules FOR ALL TO authenticated
  USING (private.owns_station(station_id)) WITH CHECK (private.owns_station(station_id));

DROP POLICY "owner reads sessions" ON public.qr_sessions;
CREATE POLICY "owner reads sessions" ON public.qr_sessions FOR SELECT TO authenticated
  USING (private.owns_station(station_id));

DROP POLICY "owner reads jobs" ON public.print_jobs;
CREATE POLICY "owner reads jobs" ON public.print_jobs FOR SELECT TO authenticated
  USING (private.owns_station(station_id));

DROP POLICY "owner updates jobs" ON public.print_jobs;
CREATE POLICY "owner updates jobs" ON public.print_jobs FOR UPDATE TO authenticated
  USING (private.owns_station(station_id)) WITH CHECK (private.owns_station(station_id));

DROP POLICY "owner reads audit" ON public.audit_logs;
CREATE POLICY "owner reads audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (private.owns_station(station_id));

DROP FUNCTION public.owns_station(uuid);
DROP FUNCTION public.has_role(uuid, public.app_role);

REVOKE EXECUTE ON FUNCTION public.seed_station_defaults(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
