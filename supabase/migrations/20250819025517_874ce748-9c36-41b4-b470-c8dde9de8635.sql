-- Additional security improvements for profiles table

-- 1. Add a security definer function to safely check if a user can access profile data
CREATE OR REPLACE FUNCTION public.can_access_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() = profile_user_id OR 
         (auth.uid() IS NOT NULL AND profile_user_id = auth.uid());
$$;

-- 2. Create a more restrictive policy for profile access
-- First drop existing policies to recreate them with better security
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;

-- 3. Create enhanced RLS policies with additional security checks
CREATE POLICY "Users can view only their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update only their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id AND 
  auth.uid() IS NOT NULL
)
WITH CHECK (
  auth.uid() = id AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can create only their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id AND 
  auth.uid() IS NOT NULL
);

-- 4. Explicitly deny all access to anonymous users
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- 5. Add a function to get current user's profile safely
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(id uuid, email text, full_name text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.email, p.full_name, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.id = auth.uid() AND auth.uid() IS NOT NULL;
$$;

-- 6. Add audit triggers for profile changes (optional security measure)
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log profile changes for security monitoring
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
    to_jsonb(OLD),
    to_jsonb(NEW),
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN others THEN
    -- Don't fail the operation if audit logging fails
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 7. Create audit log table for security monitoring (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own audit logs
CREATE POLICY "Users can view their own audit logs"
ON public.audit_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 8. Create the audit trigger (optional - uncomment if you want audit logging)
-- CREATE TRIGGER profiles_audit_trigger
--   AFTER INSERT OR UPDATE OR DELETE ON public.profiles
--   FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();