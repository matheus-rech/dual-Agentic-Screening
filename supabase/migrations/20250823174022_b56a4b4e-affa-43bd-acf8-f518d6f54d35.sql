-- Fix remaining function search path security issues

-- Fix the search_papers function with vector search
CREATE OR REPLACE FUNCTION public.search_papers(query_text text, match_count integer DEFAULT 10)
RETURNS TABLE(id bigint, title text, abstract text, authors text[], publication_date date, journal text, keywords text[], doi text, citation_count integer, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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
    (
      ts_rank(to_tsvector('english', ap.title), plainto_tsquery('english', query_text)) +
      ts_rank(to_tsvector('english', ap.abstract), plainto_tsquery('english', query_text))
    ) AS similarity
  FROM
    public.academic_papers ap
  WHERE
    to_tsvector('english', ap.title) @@ plainto_tsquery('english', query_text) OR
    to_tsvector('english', ap.abstract) @@ plainto_tsquery('english', query_text) OR
    EXISTS (SELECT 1 FROM unnest(ap.keywords) k WHERE k ILIKE '%' || query_text || '%')
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$function$;

-- Fix process_ai_screening function to include search_path
CREATE OR REPLACE FUNCTION public.process_ai_screening()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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