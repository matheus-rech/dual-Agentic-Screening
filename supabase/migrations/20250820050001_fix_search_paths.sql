-- Fix search path vulnerabilities in all functions
-- Ensure all functions use SET search_path = '' for security

-- Fix functions that may have inconsistent search paths
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
            'conflict_flag', screening_result.conflict_flag,
            'agreement_score', screening_result.agreement_score,
            'processed_at', NOW()
        )
    WHERE r.id = NEW.reference_id;
    
    RETURN NEW;
END;
$function$;

-- Ensure semantic_search function has correct search path
CREATE OR REPLACE FUNCTION public.semantic_search(query_text text, match_count integer DEFAULT 10)
RETURNS TABLE(id bigint, title text, abstract text, authors text[], publication_date date, journal text, keywords text[], doi text, citation_count integer, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ap.id,
    ap.title,
    ap.abstract,
    ap.authors,
    ap.publication_date,
    ap.journal,
    ap.keywords,
    ap.doi,
    ap.citation_count,
    1.0 - (ap.embedding <=> query_text::vector) AS similarity
  FROM
    public.academic_papers ap
  WHERE
    ap.embedding IS NOT NULL
  ORDER BY
    ap.embedding <=> query_text::text::vector
  LIMIT match_count;
END;
$function$;

-- Ensure project increment functions have correct search path
CREATE OR REPLACE FUNCTION public.increment_project_references(project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.review_projects
  SET total_references = total_references + 1
  WHERE id = project_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_project_references_by(project_id uuid, count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.review_projects
  SET total_references = total_references + count
  WHERE id = project_id;
END;
$function$;

-- Ensure audit logging functions for academic papers have correct search path
CREATE OR REPLACE FUNCTION public.log_academic_papers_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Log access to academic papers for security monitoring
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    'academic_papers_access',
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
$function$;

-- Fix any rate limiting function that might have wrong search path
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit()
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
    AND table_name = 'admin_user_access'
    AND changed_at > NOW() - INTERVAL '1 minute';
  
  -- Allow max 10 admin user access requests per minute
  RETURN recent_access_count < 10;
END;
$function$;