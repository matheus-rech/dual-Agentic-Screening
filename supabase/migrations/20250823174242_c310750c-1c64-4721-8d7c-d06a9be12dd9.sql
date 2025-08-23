-- Fix remaining critical trigger functions that need search_path

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Insert new profile with user data
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$function$;

-- Fix increment_project_references function
CREATE OR REPLACE FUNCTION public.increment_project_references(project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.review_projects
  SET total_references = total_references + 1
  WHERE id = project_id;
END;
$function$;

-- Fix increment_project_references_by function
CREATE OR REPLACE FUNCTION public.increment_project_references_by(project_id uuid, count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.review_projects
  SET total_references = total_references + count
  WHERE id = project_id;
END;
$function$;

-- Fix get_user_count function
CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only allow admins to get user count
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN (SELECT COUNT(*) FROM public.profiles);
END;
$function$;