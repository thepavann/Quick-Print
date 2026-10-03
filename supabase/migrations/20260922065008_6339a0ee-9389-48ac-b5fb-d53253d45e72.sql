
CREATE TYPE public.app_role AS ENUM ('OWNER','STAFF','ADMIN');
CREATE TYPE public.job_status AS ENUM ('QUEUED','DOWNLOADING','PRINTING','COMPLETED','FAILED','CANCELLED');
CREATE TYPE public.paper_size AS ENUM ('A4','A3');
CREATE TYPE public.color_mode AS ENUM ('BW','COLOR');
CREATE TYPE public.session_status AS ENUM ('ACTIVE','EXPIRED','REVOKED');
CREATE TYPE public.printer_status AS ENUM ('ONLINE','OFFLINE');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE TABLE public.stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  is_demo boolean NOT NULL DEFAULT false,
  session_duration_seconds integer NOT NULL DEFAULT 60,
  max_jobs_per_session integer NOT NULL DEFAULT 3,
  max_file_size_mb integer NOT NULL DEFAULT 10,
  a4_enabled boolean NOT NULL DEFAULT true,
  a3_enabled boolean NOT NULL DEFAULT true,
  color_enabled boolean NOT NULL DEFAULT true,
  duplex_enabled boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'INR',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stations TO authenticated;
GRANT ALL ON public.stations TO service_role;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages station" ON public.stations FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'ADMIN'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'ADMIN'));

CREATE OR REPLACE FUNCTION public.owns_station(_station uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stations s WHERE s.id = _station AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'ADMIN')));
$$;

CREATE TABLE public.printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Counter Printer',
  windows_printer_name text,
  status public.printer_status NOT NULL DEFAULT 'OFFLINE',
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.printers TO authenticated;
GRANT ALL ON public.printers TO service_role;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages printers" ON public.printers FOR ALL TO authenticated
  USING (public.owns_station(station_id)) WITH CHECK (public.owns_station(station_id));

CREATE TABLE public.agent_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations ON DELETE CASCADE,
  printer_id uuid REFERENCES public.printers ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Windows Print Agent',
  token_hash text NOT NULL,
  token_prefix text NOT NULL,
  last_heartbeat_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_devices TO authenticated;
GRANT ALL ON public.agent_devices TO service_role;
ALTER TABLE public.agent_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages agents" ON public.agent_devices FOR ALL TO authenticated
  USING (public.owns_station(station_id)) WITH CHECK (public.owns_station(station_id));

CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations ON DELETE CASCADE,
  paper public.paper_size NOT NULL,
  color public.color_mode NOT NULL,
  duplex boolean NOT NULL,
  price_per_page numeric(10,2) NOT NULL,
  UNIQUE (station_id, paper, color, duplex)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages pricing" ON public.pricing_rules FOR ALL TO authenticated
  USING (public.owns_station(station_id)) WITH CHECK (public.owns_station(station_id));

CREATE TABLE public.qr_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status public.session_status NOT NULL DEFAULT 'ACTIVE',
  max_jobs integer NOT NULL DEFAULT 3,
  jobs_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX qr_sessions_station_idx ON public.qr_sessions (station_id, created_at DESC);
GRANT SELECT ON public.qr_sessions TO authenticated;
GRANT ALL ON public.qr_sessions TO service_role;
ALTER TABLE public.qr_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads sessions" ON public.qr_sessions FOR SELECT TO authenticated
  USING (public.owns_station(station_id));

CREATE SEQUENCE public.job_number_seq START 10482;

CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number integer NOT NULL DEFAULT nextval('public.job_number_seq'),
  station_id uuid NOT NULL REFERENCES public.stations ON DELETE CASCADE,
  printer_id uuid REFERENCES public.printers ON DELETE SET NULL,
  session_id uuid REFERENCES public.qr_sessions ON DELETE SET NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  page_count integer NOT NULL,
  printed_pages integer NOT NULL DEFAULT 0,
  copies integer NOT NULL DEFAULT 1,
  color public.color_mode NOT NULL DEFAULT 'BW',
  duplex boolean NOT NULL DEFAULT false,
  paper public.paper_size NOT NULL DEFAULT 'A4',
  page_range text,
  amount numeric(10,2) NOT NULL,
  status public.job_status NOT NULL DEFAULT 'QUEUED',
  idempotency_key text,
  claimed_by uuid REFERENCES public.agent_devices ON DELETE SET NULL,
  demo boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (station_id, idempotency_key)
);
CREATE INDEX print_jobs_station_idx ON public.print_jobs (station_id, created_at DESC);
GRANT SELECT, UPDATE ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads jobs" ON public.print_jobs FOR SELECT TO authenticated
  USING (public.owns_station(station_id));
CREATE POLICY "owner updates jobs" ON public.print_jobs FOR UPDATE TO authenticated
  USING (public.owns_station(station_id)) WITH CHECK (public.owns_station(station_id));

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid REFERENCES public.stations ON DELETE CASCADE,
  actor text NOT NULL,
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_station_idx ON public.audit_logs (station_id, created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.owns_station(station_id));

CREATE OR REPLACE FUNCTION public.seed_station_defaults(_station uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.pricing_rules (station_id, paper, color, duplex, price_per_page) VALUES
    (_station,'A4','BW',false,2.00),
    (_station,'A4','BW',true,1.50),
    (_station,'A4','COLOR',false,10.00),
    (_station,'A4','COLOR',true,8.00),
    (_station,'A3','BW',false,5.00),
    (_station,'A3','BW',true,4.00),
    (_station,'A3','COLOR',false,15.00),
    (_station,'A3','COLOR',true,12.00)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.printers (station_id, name, windows_printer_name)
  SELECT _station, 'Counter Printer', 'HP LaserJet Pro'
  WHERE NOT EXISTS (SELECT 1 FROM public.printers WHERE station_id = _station);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_station uuid;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'OWNER') ON CONFLICT DO NOTHING;
  INSERT INTO public.stations (owner_id, name, location)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'station_name','My Stationery'), 'Main Counter')
  RETURNING id INTO new_station;
  PERFORM public.seed_station_defaults(new_station);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.stations (id, owner_id, name, location, is_demo)
VALUES ('11111111-1111-4111-8111-111111111111', NULL, 'ABC Stationery', 'College Main Gate', true);
INSERT INTO public.printers (id, station_id, name, windows_printer_name, status, last_seen_at)
VALUES ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Counter Printer','HP LaserJet Pro','ONLINE', now());
SELECT public.seed_station_defaults('11111111-1111-4111-8111-111111111111');
