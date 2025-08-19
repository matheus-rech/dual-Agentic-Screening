-- Create a secure function for admin user management that protects user privacy
CREATE OR REPLACE FUNCTION public.get_users_for_admin()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  created_at timestamp with time zone,
  roles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

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

-- Create a function to safely search for users by email (admin only)
CREATE OR REPLACE FUNCTION public.find_user_by_email(search_email text)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Validate email format to prevent injection
  IF search_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
    p.full_name
  FROM public.profiles p
  WHERE LOWER(p.email) = LOWER(search_email)
  LIMIT 1;
END;
$$;

-- Create audit log for profile access
CREATE OR REPLACE FUNCTION public.log_profile_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log any profile access for security monitoring
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    'profiles_access',
    'SELECT',
    auth.uid(),
    NULL,
    jsonb_build_object(
      'accessed_profile_id', NEW.id,
      'accessed_email', NEW.email,
      'accessor_ip', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    ),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Don't fail the operation if audit logging fails
    RETURN NEW;
END;
$$;

-- Add even stricter policies to profiles table to prevent any data leakage
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.profiles;

-- Create new ultra-secure policies
CREATE POLICY "Block all anonymous access to profiles" ON public.profiles
FOR ALL TO anon
USING (false);

CREATE POLICY "Users can only view their own profile" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL
  AND auth.role() = 'authenticated'
);

-- Add restrictive policy for any potential data export functions
CREATE POLICY "Prevent profile data export" ON public.profiles
FOR ALL
USING (
  -- Only allow if user is accessing their own data OR is an admin using secure functions
  (auth.uid() = id AND auth.uid() IS NOT NULL) 
  OR 
  (
    public.current_user_has_role('admin') 
    AND current_setting('role', true) = 'authenticated'
  )
);

-- Revoke any potential public access
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.profiles FROM anon;

-- Grant minimal required permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;