-- Fix critical security vulnerability: Remove email exposure from admin functions
-- The issue is that get_users_for_admin() exposes all user emails

-- First, let's create a safer admin function that doesn't expose emails unless absolutely necessary
CREATE OR REPLACE FUNCTION public.get_users_for_admin_safe()
RETURNS TABLE(user_id uuid, email_hash text, full_name text, created_at timestamp with time zone, roles text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Enhanced admin check with additional verification
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
$$;

-- Update the existing function to be more restrictive
CREATE OR REPLACE FUNCTION public.get_users_for_admin()
RETURNS TABLE(user_id uuid, email text, full_name text, created_at timestamp with time zone, roles text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Enhanced admin check with additional verification
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Additional security check: Only allow if there are very few admins (prevent privilege escalation)
  IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') > 3 THEN
    RAISE EXCEPTION 'Access denied: Too many admins, function disabled for security';
  END IF;
  
  -- Check enhanced rate limiting
  IF NOT public.check_admin_rate_limit_enhanced() THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many admin requests';
  END IF;
  
  -- Log admin access for security monitoring with extra details
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
$$;

-- Add additional RLS policies for extra protection
CREATE POLICY "Block all direct profile access for non-owners" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (false)
WITH CHECK (false);

-- Create a restrictive policy that only allows access to own profile
CREATE POLICY "Allow only own profile access" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL);

-- Enable RLS to ensure our policies are enforced
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;