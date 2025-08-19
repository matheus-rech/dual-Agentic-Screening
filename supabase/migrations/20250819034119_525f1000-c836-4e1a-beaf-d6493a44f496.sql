-- Critical Security Fixes for Database Vulnerabilities

-- 1. SECURE ACADEMIC PAPERS TABLE - Remove dangerous public access
DROP POLICY IF EXISTS "Allow all users to view papers" ON public.academic_papers;
DROP POLICY IF EXISTS "Allow authenticated users to insert papers" ON public.academic_papers;
DROP POLICY IF EXISTS "Allow authenticated users to update papers" ON public.academic_papers;
DROP POLICY IF EXISTS "Allow authenticated users to delete papers" ON public.academic_papers;

-- Create secure policies for academic papers - restrict to authenticated users only
CREATE POLICY "Authenticated users can view papers" ON public.academic_papers
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin users can manage papers" ON public.academic_papers
FOR ALL TO authenticated
USING (public.current_user_has_role('admin'))
WITH CHECK (public.current_user_has_role('admin'));

-- 2. FIX PROFILES TABLE - Remove admin bypass vulnerability
DROP POLICY IF EXISTS "Prevent profile data export" ON public.profiles;

-- Create more restrictive profile policy
CREATE POLICY "Strict profile access control" ON public.profiles
FOR ALL TO authenticated
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL);

-- 3. FIX DATABASE FUNCTION SEARCH PATH VULNERABILITIES
-- Update semantic_search function
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

-- Update can_access_profile function
CREATE OR REPLACE FUNCTION public.can_access_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() = profile_user_id AND auth.uid() IS NOT NULL;
$function$;

-- Update get_current_user_profile function
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(id uuid, email text, full_name text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.id, p.email, p.full_name, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.id = auth.uid() AND auth.uid() IS NOT NULL;
$function$;

-- Update increment_project_references function
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

-- Update increment_project_references_by function
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

-- 4. ADD ENHANCED AUDIT LOGGING FOR SECURITY MONITORING
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

-- Create trigger for academic papers audit logging
DROP TRIGGER IF EXISTS audit_academic_papers_access ON public.academic_papers;
CREATE TRIGGER audit_academic_papers_access
  AFTER INSERT OR UPDATE OR DELETE ON public.academic_papers
  FOR EACH ROW EXECUTE FUNCTION public.log_academic_papers_access();

-- 5. REVOKE DANGEROUS PUBLIC PERMISSIONS
REVOKE ALL ON public.academic_papers FROM public;
REVOKE ALL ON public.academic_papers FROM anon;

-- Grant minimal required permissions
GRANT SELECT ON public.academic_papers TO authenticated;