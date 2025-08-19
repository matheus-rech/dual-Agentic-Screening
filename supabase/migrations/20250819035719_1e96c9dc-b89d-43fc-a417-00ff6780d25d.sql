-- Phase 1: Critical Access Control Fixes
-- Remove public access to academic papers - require authentication
DROP POLICY IF EXISTS "Authenticated users can view papers" ON public.academic_papers;
CREATE POLICY "Authenticated users can view papers" 
ON public.academic_papers 
FOR SELECT 
TO authenticated
USING (true);

-- Restrict paper references to authenticated users only
DROP POLICY IF EXISTS "Secure view paper references" ON public.paper_references;
CREATE POLICY "Authenticated users can view paper references" 
ON public.paper_references 
FOR SELECT 
TO authenticated
USING (true);

-- Phase 2: Database Function Security - Fix search path issues
CREATE OR REPLACE FUNCTION public.semantic_search(query_embedding vector, match_threshold double precision DEFAULT 0.7, match_count integer DEFAULT 10)
RETURNS TABLE(id bigint, title text, abstract text, authors text[], publication_date date, journal text, keywords text[], similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.abstract,
    p.authors,
    p.publication_date,
    p.journal,
    p.keywords,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.academic_papers p
  WHERE p.embedding IS NOT NULL
  AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_papers(query_text text, match_count integer DEFAULT 10)
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
    1.0 - (ap.embedding <=> plainto_tsquery(query_text)::text::vector) AS similarity
  FROM
    public.academic_papers ap
  WHERE
    ap.embedding IS NOT NULL
  ORDER BY
    ap.embedding <=> plainto_tsquery(query_text)::text::vector
  LIMIT match_count;
END;
$function$;

-- Enhanced rate limiting function for admin operations
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit_enhanced()
RETURNS boolean
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
    AND table_name IN ('admin_user_access', 'profiles_access', 'user_management')
    AND changed_at > NOW() - INTERVAL '1 minute';
  
  -- Allow max 5 admin operations per minute (stricter limit)
  RETURN recent_access_count < 5;
END;
$function$;

-- Update admin functions to use enhanced rate limiting
CREATE OR REPLACE FUNCTION public.get_users_for_admin()
RETURNS TABLE(user_id uuid, email text, full_name text, created_at timestamp with time zone, roles text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Enhanced admin check with additional verification
  IF NOT public.current_user_has_role('admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Check enhanced rate limiting
  IF NOT public.check_admin_rate_limit_enhanced() THEN
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
$function$;