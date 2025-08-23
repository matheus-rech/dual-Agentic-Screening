-- Fix security vulnerability: Restrict screening data access to project owners only

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view reasoning steps" ON public.screening_reasoning_steps;
DROP POLICY IF EXISTS "Users can insert reasoning steps" ON public.screening_reasoning_steps;
DROP POLICY IF EXISTS "Users can view their own screening progress" ON public.screening_progress;
DROP POLICY IF EXISTS "Users can update their own screening progress" ON public.screening_progress;

-- Create secure policies for screening_reasoning_steps
-- Users can only view reasoning steps for their own projects
CREATE POLICY "Users can view reasoning steps for own projects" 
ON public.screening_reasoning_steps 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.screening_progress sp
    JOIN public.review_projects rp ON sp.project_id = rp.id
    WHERE sp.session_id = screening_reasoning_steps.session_id
    AND rp.user_id = auth.uid()
  )
);

-- Users can only insert reasoning steps for their own projects
CREATE POLICY "Users can insert reasoning steps for own projects" 
ON public.screening_reasoning_steps 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.screening_progress sp
    JOIN public.review_projects rp ON sp.project_id = rp.id
    WHERE sp.session_id = screening_reasoning_steps.session_id
    AND rp.user_id = auth.uid()
  )
);

-- Create secure policies for screening_progress
-- Users can only view progress for their own projects
CREATE POLICY "Users can view progress for own projects" 
ON public.screening_progress 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.review_projects rp
    WHERE rp.id = screening_progress.project_id
    AND rp.user_id = auth.uid()
  )
);

-- Users can only update progress for their own projects
CREATE POLICY "Users can update progress for own projects" 
ON public.screening_progress 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.review_projects rp
    WHERE rp.id = screening_progress.project_id
    AND rp.user_id = auth.uid()
  )
);

-- Users can only insert progress for their own projects
CREATE POLICY "Users can insert progress for own projects" 
ON public.screening_progress 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.review_projects rp
    WHERE rp.id = screening_progress.project_id
    AND rp.user_id = auth.uid()
  )
);

-- Users can only delete progress for their own projects
CREATE POLICY "Users can delete progress for own projects" 
ON public.screening_progress 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.review_projects rp
    WHERE rp.id = screening_progress.project_id
    AND rp.user_id = auth.uid()
  )
);

-- Add audit logging for these sensitive operations
CREATE OR REPLACE FUNCTION public.audit_screening_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN others THEN
    -- Don't fail the operation if audit logging fails
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Add audit triggers for security monitoring
CREATE TRIGGER audit_screening_progress_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.screening_progress
  FOR EACH ROW EXECUTE FUNCTION public.audit_screening_access();

CREATE TRIGGER audit_screening_reasoning_trigger  
  AFTER INSERT OR UPDATE OR DELETE ON public.screening_reasoning_steps
  FOR EACH ROW EXECUTE FUNCTION public.audit_screening_access();