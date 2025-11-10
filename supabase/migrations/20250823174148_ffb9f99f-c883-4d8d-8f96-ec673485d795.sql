-- Fix the last remaining custom functions that need search_path

-- Fix create_embeddings_column_function
CREATE OR REPLACE FUNCTION public.create_embeddings_column_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Create the helper function
  CREATE OR REPLACE FUNCTION public.check_and_add_embeddings_column()
  RETURNS void
  SECURITY DEFINER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $FUNC$
  DECLARE
    column_exists BOOLEAN;
  BEGIN
    -- Check if the embedding column exists
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'academic_papers'
      AND column_name = 'embedding'
    ) INTO column_exists;
    
    -- If the column doesn't exist, add it
    IF NOT column_exists THEN
      EXECUTE 'ALTER TABLE public.academic_papers ADD COLUMN embedding vector(384)';
      
      -- Create a GIN index for faster vector searches
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_academic_papers_embedding ON public.academic_papers USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)';
    END IF;
  END;
  $FUNC$;
  
  -- Set search path for security
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_and_add_embeddings_column() FROM PUBLIC';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.check_and_add_embeddings_column() TO service_role';
END;
$function$;