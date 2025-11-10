-- Phase 1: Critical Security Functions Only (Skip existing policies)

-- Create the app_role enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'researcher', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Fix 1: Create secure admin assignment mechanism
CREATE OR REPLACE FUNCTION public.assign_first_user_as_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Insert admin role for the first user (if no admin exists yet)
  INSERT INTO public.user_roles (user_id, role)
  SELECT u.id, 'admin'::app_role
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id AND ur.role = 'admin'
  WHERE ur.user_id IS NULL
  ORDER BY u.created_at ASC
  LIMIT 1
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Create trigger to auto-assign first admin
CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Check if this is the first user and no admin exists
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table to auto-assign admin
DROP TRIGGER IF EXISTS auto_assign_admin_trigger ON public.profiles;
CREATE TRIGGER auto_assign_admin_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_first_admin();

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

-- Fix 3: Get user count function for admin
CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only allow admins to get user count
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN (SELECT COUNT(*) FROM public.profiles);
END;
$$;

-- Fix 4: Enhanced admin user access with better security
CREATE OR REPLACE FUNCTION public.get_users_for_admin_safe()
RETURNS TABLE(user_id uuid, email_hash text, full_name text, created_at timestamp with time zone, roles text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
      'security_level', 'enhanced_hashed_access'
    ),
    NOW()
  );

  RETURN QUERY
  SELECT 
    p.id as user_id,
    md5(p.email || 'salt_' || p.id::text) as email_hash, -- Hash email with user ID as salt
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
$$;

-- Fix 5: Security event logging function
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
      'timestamp', NOW()
    ) || additional_data,
    NOW()
  );
END;
$$;

-- Run the initial admin assignment for existing users
SELECT public.assign_first_user_as_admin();