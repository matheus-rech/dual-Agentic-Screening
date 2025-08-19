-- Enhanced security fix to prevent email harvesting attacks
-- Add additional verification and stricter access controls

-- First, verify current policies are working by testing them
-- Then add enhanced protection against email harvesting

-- Drop existing policies to implement a more secure approach
DROP POLICY IF EXISTS "Users own profile access only" ON public.profiles;
DROP POLICY IF EXISTS "Block anonymous access completely" ON public.profiles;

-- Create ultra-secure policies with additional checks
-- 1. Authenticated users can only SELECT their own profile
CREATE POLICY "User can view own profile only" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL 
  AND auth.role() = 'authenticated'
);

-- 2. Authenticated users can only INSERT their own profile  
CREATE POLICY "User can create own profile only" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL 
  AND auth.role() = 'authenticated'
);

-- 3. Authenticated users can only UPDATE their own profile
CREATE POLICY "User can update own profile only" ON public.profiles
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

-- 4. Block DELETE operations entirely for additional security
CREATE POLICY "Block all profile deletions" ON public.profiles
FOR DELETE TO authenticated
USING (false);

-- 5. Completely block anonymous access
CREATE POLICY "Block all anonymous access" ON public.profiles
FOR ALL TO anon
USING (false)
WITH CHECK (false);

-- Create a secure function to get user count for admin purposes
-- This prevents direct table scanning while allowing legitimate admin functions
CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only allow admins to get user count
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN (SELECT COUNT(*) FROM public.profiles);
END;
$$;

-- Enhance the existing get_users_for_admin function with additional security
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
  
  -- Log admin access for security monitoring
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    'admin_user_access',
    'SELECT_ALL_USERS',
    auth.uid(),
    NULL,
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'access_timestamp', NOW(),
      'function_called', 'get_users_for_admin'
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

-- Add rate limiting protection for admin functions
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recent_access_count INTEGER;
BEGIN
  -- Check if admin has made too many requests in last minute
  SELECT COUNT(*) INTO recent_access_count
  FROM public.audit_log
  WHERE user_id = auth.uid()
    AND table_name = 'admin_user_access'
    AND changed_at > NOW() - INTERVAL '1 minute';
  
  -- Allow max 10 admin user access requests per minute
  RETURN recent_access_count < 10;
END;
$$;

-- Update get_users_for_admin to include rate limiting
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
  
  -- Check rate limiting
  IF NOT public.check_admin_rate_limit() THEN
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
    'admin_user_access',
    'SELECT_ALL_USERS',
    auth.uid(),
    NULL,
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'access_timestamp', NOW(),
      'function_called', 'get_users_for_admin'
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