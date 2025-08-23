-- Fix all critical function search path security issues

-- Fix assign_first_user_as_admin
CREATE OR REPLACE FUNCTION public.assign_first_user_as_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

-- Fix auto_assign_first_admin
CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Check if this is the first user and no admin exists
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix current_user_has_role
CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), _role);
$function$;

-- Fix can_access_profile
CREATE OR REPLACE FUNCTION public.can_access_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT auth.uid() = profile_user_id AND auth.uid() IS NOT NULL;
$function$;

-- Fix check_admin_rate_limit
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

-- Fix check_admin_rate_limit_enhanced  
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit_enhanced()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  recent_access_count INTEGER;
BEGIN
  -- Check if admin has made too many requests in last minute
  SELECT COUNT(*) INTO recent_access_count
  FROM public.audit_log
  WHERE user_id = auth.uid()
    AND table_name IN ('admin_user_access', 'profiles_access', 'user_management')
    AND changed_at > NOW() - INTERVAL '1 minute';
  
  -- Allow max 5 admin operations per minute (stricter limit)
  RETURN recent_access_count < 5;
END;
$function$;