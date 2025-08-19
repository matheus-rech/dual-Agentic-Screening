-- Fix search path security issues in functions

-- 1. Update can_access_profile function with proper search path
CREATE OR REPLACE FUNCTION public.can_access_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT auth.uid() = profile_user_id OR 
         (auth.uid() IS NOT NULL AND profile_user_id = auth.uid());
$$;

-- 2. Update get_current_user_profile function with proper search path
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(id uuid, email text, full_name text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p.id, p.email, p.full_name, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.id = auth.uid() AND auth.uid() IS NOT NULL;
$$;

-- 3. Update audit_profile_changes function with proper search path
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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