-- Create sessions table for proper session validation
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Enable RLS on sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Create index for token lookup
CREATE INDEX idx_sessions_token ON public.sessions(token);
CREATE INDEX idx_sessions_expires_at ON public.sessions(expires_at);

-- Drop overly permissive RESTRICTIVE policies on all tables
DROP POLICY IF EXISTS "Allow all for service role" ON public.users;
DROP POLICY IF EXISTS "Allow all for service role" ON public.user_roles;
DROP POLICY IF EXISTS "Allow all for service role" ON public.menus;
DROP POLICY IF EXISTS "Allow all for service role" ON public.role_menus;
DROP POLICY IF EXISTS "Allow all for service role" ON public.packages;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.workflows;
DROP POLICY IF EXISTS "Allow public read for public workflows" ON public.workflows;

-- Create proper policies that deny public access
-- All tables should ONLY be accessible via edge functions using service role
-- The edge functions will handle authentication and authorization

-- Users: No direct access (edge function handles it)
CREATE POLICY "Deny all direct access to users"
ON public.users FOR ALL
USING (false);

-- User roles: No direct access
CREATE POLICY "Deny all direct access to user_roles"
ON public.user_roles FOR ALL
USING (false);

-- Menus: No direct access
CREATE POLICY "Deny all direct access to menus"
ON public.menus FOR ALL
USING (false);

-- Role menus: No direct access
CREATE POLICY "Deny all direct access to role_menus"
ON public.role_menus FOR ALL
USING (false);

-- Packages: No direct access
CREATE POLICY "Deny all direct access to packages"
ON public.packages FOR ALL
USING (false);

-- Sessions: No direct access
CREATE POLICY "Deny all direct access to sessions"
ON public.sessions FOR ALL
USING (false);

-- Workflows: Allow public read for public workflows only
CREATE POLICY "Allow public read for public workflows"
ON public.workflows FOR SELECT
USING (is_public = true);

-- Workflows: No other direct access
CREATE POLICY "Deny other direct access to workflows"
ON public.workflows FOR ALL
USING (false);

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.sessions WHERE expires_at < now();
$$;

-- Create function to verify session (for edge functions)
CREATE OR REPLACE FUNCTION public.verify_session(session_token text, OUT user_id uuid, OUT is_valid boolean)
RETURNS record
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id, (s.expires_at > now() AND u.is_active) as is_valid
  FROM public.sessions s
  JOIN public.users u ON s.user_id = u.id
  WHERE s.token = session_token
  LIMIT 1;
$$;