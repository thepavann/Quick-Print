-- Keep existing Supabase projects compatible with the standalone print-agent workflow.
-- Fresh installs already receive DOWNLOADING from the base migration.
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'DOWNLOADING';
