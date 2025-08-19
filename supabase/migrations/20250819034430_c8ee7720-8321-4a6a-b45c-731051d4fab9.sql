-- Fix conflicting RLS policies on profiles table
-- Remove all existing policies to eliminate conflicts

DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Block all anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can only view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Strict profile access control" ON public.profiles;

-- Create a single, comprehensive policy that covers all operations
-- This prevents any potential conflicts and ensures clear access control
CREATE POLICY "Users own profile access only" ON public.profiles
FOR ALL TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Explicitly block all anonymous access with a separate policy
CREATE POLICY "Block anonymous access completely" ON public.profiles
FOR ALL TO anon
USING (false)
WITH CHECK (false);

-- Add additional security: ensure no public access to profiles
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.profiles FROM anon;

-- Grant only necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Add audit logging trigger for profile access if not already exists
CREATE OR REPLACE FUNCTION public.audit_profile_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- Create trigger for audit logging if it doesn't exist
DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_access();