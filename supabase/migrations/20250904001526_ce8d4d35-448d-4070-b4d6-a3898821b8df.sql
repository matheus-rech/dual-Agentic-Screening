-- Phase 1: Create missing enum and security fixes

-- Create the app_role enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'researcher', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Fix 1: Strengthen profiles table RLS policies
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Prevent all profile deletions" ON public.profiles;

-- Create more granular profile policies
CREATE POLICY "Users can view own profile only"
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile only"
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own profile only"
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL);

-- Completely prevent profile deletions for security
CREATE POLICY "No profile deletions allowed"
ON public.profiles 
FOR DELETE 
USING (false);

-- Fix 2: Enhanced rate limiting function
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit_strict()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  recent_access_count INTEGER;
  admin_action_count INTEGER;
BEGIN
  -- Check recent admin operations (stricter limit)
  SELECT COUNT(*) INTO recent_access_count
  FROM public.audit_log
  WHERE user_id = auth.uid()
    AND table_name LIKE '%admin%'
    AND changed_at > NOW() - INTERVAL '1 minute';
  
  -- Check admin actions in last 5 minutes for additional security
  SELECT COUNT(*) INTO admin_action_count
  FROM public.audit_log
  WHERE user_id = auth.uid()
    AND (
      table_name LIKE '%admin%' 
      OR operation LIKE '%ADMIN%'
      OR new_data::text LIKE '%admin%'
    )
    AND changed_at > NOW() - INTERVAL '5 minutes';
  
  -- Allow max 3 admin operations per minute, 10 per 5 minutes
  RETURN recent_access_count < 3 AND admin_action_count < 10;
END;
$$;

-- Fix 3: Security event logging function
CREATE OR REPLACE FUNCTION public.log_security_event(event_type text, event_description text, additional_data jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    'security_events',
    event_type,
    auth.uid(),
    NULL,
    jsonb_build_object(
      'event_description', event_description,
      'user_id', auth.uid(),
      'timestamp', NOW(),
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
      'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
    ) || additional_data,
    NOW()
  );
END;
$$;

-- Fix 4: Audit log cleanup for compliance
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Keep audit logs for 1 year for security compliance
  DELETE FROM public.audit_log
  WHERE changed_at < NOW() - INTERVAL '1 year';
  
  -- Log the cleanup operation
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    'audit_log_cleanup',
    'MAINTENANCE',
    NULL,
    NULL,
    jsonb_build_object(
      'cleanup_timestamp', NOW(),
      'retention_period', '1 year'
    ),
    NOW()
  );
END;
$$;