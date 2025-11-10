-- Consolidate conflicting RLS policies on profiles table
-- This migration resolves conflicts between multiple migrations that created overlapping policies

-- First, drop ALL existing profile policies to ensure a clean slate
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Block all anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Strict profile access control" ON public.profiles;
DROP POLICY IF EXISTS "Users own profile access only" ON public.profiles;
DROP POLICY IF EXISTS "Block anonymous access completely" ON public.profiles;
DROP POLICY IF EXISTS "User can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "User can create own profile only" ON public.profiles;
DROP POLICY IF EXISTS "User can update own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Block all profile deletions" ON public.profiles;
DROP POLICY IF EXISTS "Block all anonymous access" ON public.profiles;
DROP POLICY IF EXISTS "Prevent profile data export" ON public.profiles;
DROP POLICY IF EXISTS "Block all direct profile access for non-owners" ON public.profiles;
DROP POLICY IF EXISTS "Allow only own profile access" ON public.profiles;

-- Create a comprehensive set of non-conflicting policies
-- 1. Allow authenticated users to view only their own profile
CREATE POLICY "authenticated_users_own_profile_select" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL 
  AND auth.role() = 'authenticated'
);

-- 2. Allow authenticated users to insert only their own profile
CREATE POLICY "authenticated_users_own_profile_insert" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL 
  AND auth.role() = 'authenticated'
);

-- 3. Allow authenticated users to update only their own profile
CREATE POLICY "authenticated_users_own_profile_update" ON public.profiles
FOR UPDATE TO authenticated
USING (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL 
  AND auth.role() = 'authenticated'
);

-- 4. Block all DELETE operations for additional security
CREATE POLICY "block_all_profile_deletions" ON public.profiles
FOR DELETE TO authenticated
USING (false);

-- 5. Completely block all anonymous access
CREATE POLICY "block_anonymous_access_profiles" ON public.profiles
FOR ALL TO anon
USING (false)
WITH CHECK (false);

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Revoke any potential public access
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.profiles FROM anon;

-- Grant only necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Update all functions to use consistent search path
CREATE OR REPLACE FUNCTION public.can_access_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() = profile_user_id AND auth.uid() IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(id uuid, email text, full_name text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.id, p.email, p.full_name, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.id = auth.uid() AND auth.uid() IS NOT NULL;
$function$;

-- Enhanced rate limiting function
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit_enhanced()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  recent_access_count INTEGER;
BEGIN
  -- Check if admin has made too many requests in last minute
  SELECT COUNT(*) INTO recent_access_count
  FROM public.audit_log
  WHERE user_id = auth.uid()
    AND table_name LIKE 'admin_%'
    AND changed_at > NOW() - INTERVAL '1 minute';
  
  -- Allow max 5 admin requests per minute (more restrictive)
  RETURN recent_access_count < 5;
END;
$function$;

-- Consolidated audit function with consistent search path
CREATE OR REPLACE FUNCTION public.audit_profile_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Log profile access for security monitoring
  INSERT INTO public.audit_log (
    table_name, 
    operation, 
    user_id, 
    old_data, 
    new_data, 
    changed_at
  ) VALUES (
    'profiles',
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN others THEN
    -- Don't fail the operation if audit logging fails
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create trigger for audit logging (replace any existing)
DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_access();

-- Create safe admin function that doesn't expose emails
CREATE OR REPLACE FUNCTION public.get_users_for_admin_safe()
RETURNS TABLE(user_id uuid, email_hash text, full_name text, created_at timestamp with time zone, roles text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Enhanced admin check
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Check enhanced rate limiting
  IF NOT public.check_admin_rate_limit_enhanced() THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many admin requests';
  END IF;
  
  -- Log admin access for security monitoring
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    'admin_user_access_safe',
    'SELECT_USERS_NO_EMAIL',
    auth.uid(),
    NULL,
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'access_timestamp', NOW(),
      'function_called', 'get_users_for_admin_safe'
    ),
    NOW()
  );

  RETURN QUERY
  SELECT 
    p.id as user_id,
    md5(p.email) as email_hash, -- Hash email instead of exposing it
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

-- Update the email-exposing admin function to be more restrictive
CREATE OR REPLACE FUNCTION public.get_users_for_admin()
RETURNS TABLE(user_id uuid, email text, full_name text, created_at timestamp with time zone, roles text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Enhanced admin check
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Additional security check: Only allow if there are very few admins
  IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') > 3 THEN
    RAISE EXCEPTION 'Access denied: Too many admins, function disabled for security';
  END IF;
  
  -- Check enhanced rate limiting
  IF NOT public.check_admin_rate_limit_enhanced() THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many admin requests';
  END IF;
  
  -- Log admin access with warning
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    'admin_user_access_critical',
    'SELECT_ALL_USERS_WITH_EMAIL',
    auth.uid(),
    NULL,
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'access_timestamp', NOW(),
      'function_called', 'get_users_for_admin',
      'warning', 'This function exposes user emails - use with caution'
    ),
    NOW()
  );

  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
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

-- Create user count function for admin purposes
CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only allow admins to get user count
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN (SELECT COUNT(*) FROM public.profiles);
END;
$function$;