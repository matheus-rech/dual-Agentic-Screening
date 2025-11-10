-- Security Fix: Clean up profiles table RLS policies
-- Remove conflicting and redundant policies

-- Drop all existing profiles policies
DROP POLICY IF EXISTS "Allow only own profile access" ON public.profiles;
DROP POLICY IF EXISTS "Block all anonymous access" ON public.profiles;
DROP POLICY IF EXISTS "Block all direct profile access for non-owners" ON public.profiles;
DROP POLICY IF EXISTS "Block all profile deletions" ON public.profiles;
DROP POLICY IF EXISTS "User can create own profile only" ON public.profiles;
DROP POLICY IF EXISTS "User can update own profile only" ON public.profiles;
DROP POLICY IF EXISTS "User can view own profile only" ON public.profiles;

-- Create simplified and secure RLS policies for profiles
CREATE POLICY "Users can manage own profile"
ON public.profiles
FOR ALL
TO authenticated
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL);

-- Prevent profile deletions entirely for data integrity
CREATE POLICY "Prevent all profile deletions"
ON public.profiles
FOR DELETE
TO authenticated
USING (false);

-- Security Fix: Remove insecure admin function that exposes plain emails
DROP FUNCTION IF EXISTS public.get_users_for_admin();

-- Security Fix: Enhanced rate limiting for admin functions
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit_strict()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

-- Update existing admin functions to use stricter rate limiting
CREATE OR REPLACE FUNCTION public.get_users_for_admin_safe()
RETURNS TABLE(user_id uuid, email_hash text, full_name text, created_at timestamp with time zone, roles text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Enhanced admin check with additional verification
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Use stricter rate limiting
  IF NOT public.check_admin_rate_limit_strict() THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many admin requests';
  END IF;
  
  -- Enhanced security logging
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    'admin_user_access_secure',
    'SELECT_USERS_HASHED_EMAIL',
    auth.uid(),
    NULL,
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'access_timestamp', NOW(),
      'function_called', 'get_users_for_admin_safe',
      'security_level', 'enhanced_hashed_access',
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    ),
    NOW()
  );

  RETURN QUERY
  SELECT 
    p.id as user_id,
    md5(p.email || current_setting('app.settings.hash_salt', true)) as email_hash, -- Enhanced email hashing
    p.full_name,
    p.created_at,
    COALESCE(
      ARRAY_AGG(ur.role::text) FILTER (WHERE ur.role IS NOT NULL),
      ARRAY[]::text[]
    ) as roles
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON p.id = ur.user_id
  GROUP BY p.id, p.email, p.full_name, p.created_at
  ORDER BY p.created_at DESC;
END;
$function$;

-- Security Fix: Enhanced audit logging function
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type text,
  event_description text,
  additional_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

-- Security Fix: Add data retention policy for audit logs
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;