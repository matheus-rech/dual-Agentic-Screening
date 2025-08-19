-- Fix remaining functions with search path issues
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.process_ai_screening()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
    screening_result RECORD;
BEGIN
    -- Evaluate AI screening
    SELECT 
        final_decision, 
        conflict_flag, 
        agreement_score 
    INTO screening_result
    FROM public.evaluate_ai_screening_agreement(
        NEW.primary_model_decision,
        NEW.secondary_model_decision,
        NEW.primary_model_confidence,
        NEW.secondary_model_confidence
    );
    
    -- Update reference with AI screening results
    UPDATE public.references r
    SET 
        status = screening_result.final_decision,
        ai_conflict_flag = screening_result.conflict_flag,
        ai_screening_details = jsonb_build_object(
            'final_decision', screening_result.final_decision,
            'agreement_score', screening_result.agreement_score,
            'processed_at', NOW()
        )
    WHERE r.id = NEW.reference_id;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_first_user_as_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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