-- Fix function search path security issues

-- Fix search_papers function (first version)
CREATE OR REPLACE FUNCTION public.search_papers(search_query text)
RETURNS TABLE(id bigint, title text, abstract text, authors text[], publication_date date, journal text, keywords text[], doi text, citation_count integer, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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
    p.doi,
    p.citation_count,
    (
      ts_rank(to_tsvector('english', p.title), plainto_tsquery('english', search_query)) +
      ts_rank(to_tsvector('english', p.abstract), plainto_tsquery('english', search_query))
    ) AS similarity
  FROM
    public.academic_papers p
  WHERE
    to_tsvector('english', p.title) @@ plainto_tsquery('english', search_query) OR
    to_tsvector('english', p.abstract) @@ plainto_tsquery('english', search_query) OR
    EXISTS (SELECT 1 FROM unnest(p.keywords) k WHERE k ILIKE '%' || search_query || '%')
  ORDER BY
    similarity DESC;
END;
$function$;

-- Fix evaluate_ai_screening_agreement function  
CREATE OR REPLACE FUNCTION public.evaluate_ai_screening_agreement(primary_decision text, secondary_decision text, primary_confidence numeric, secondary_confidence numeric)
RETURNS TABLE(final_decision text, conflict_flag boolean, agreement_score numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    decision_agreement NUMERIC;
    confidence_weight NUMERIC;
BEGIN
    -- Basic decision agreement
    decision_agreement := CASE 
        WHEN primary_decision = secondary_decision THEN 1.0
        ELSE 0.0
    END;
    
    -- Weighted by confidence
    confidence_weight := (primary_confidence + secondary_confidence) / 2;
    
    -- Complex decision logic
    RETURN QUERY 
    SELECT 
        CASE 
            WHEN decision_agreement = 1.0 THEN primary_decision
            WHEN confidence_weight > 0.8 THEN 
                COALESCE(
                    NULLIF(primary_decision, ''),
                    NULLIF(secondary_decision, '')
                )
            ELSE 'uncertain'
        END AS final_decision,
        (decision_agreement = 0.0) AS conflict_flag,
        decision_agreement * confidence_weight AS agreement_score;
END;
$function$;