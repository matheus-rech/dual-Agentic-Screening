-- Create screening_progress table for real-time progress tracking
CREATE TABLE public.screening_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  session_id UUID NOT NULL UNIQUE,
  current_reference_index INTEGER NOT NULL DEFAULT 0,
  total_references INTEGER NOT NULL,
  completed_count INTEGER NOT NULL DEFAULT 0,
  included_count INTEGER NOT NULL DEFAULT 0,
  excluded_count INTEGER NOT NULL DEFAULT 0,
  conflict_count INTEGER NOT NULL DEFAULT 0,
  current_reference_id TEXT,
  current_reference_title TEXT,
  current_reference_authors TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error')),
  estimated_time_remaining INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create screening_reasoning_steps table for reasoning tracking
CREATE TABLE public.screening_reasoning_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.screening_progress(session_id) ON DELETE CASCADE,
  reference_id TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  step_description TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  confidence NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.screening_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_reasoning_steps ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming auth is implemented)
CREATE POLICY "Users can view their own screening progress" 
ON public.screening_progress 
FOR SELECT 
USING (true); -- Make it public for now, adjust based on auth implementation

CREATE POLICY "Users can update their own screening progress" 
ON public.screening_progress 
FOR ALL 
USING (true); -- Make it public for now, adjust based on auth implementation

CREATE POLICY "Users can view reasoning steps" 
ON public.screening_reasoning_steps 
FOR SELECT 
USING (true); -- Make it public for now, adjust based on auth implementation

CREATE POLICY "Users can insert reasoning steps" 
ON public.screening_reasoning_steps 
FOR INSERT 
WITH CHECK (true); -- Make it public for now, adjust based on auth implementation

-- Create indexes for better performance
CREATE INDEX idx_screening_progress_session_id ON public.screening_progress(session_id);
CREATE INDEX idx_screening_progress_project_id ON public.screening_progress(project_id);
CREATE INDEX idx_reasoning_steps_session_id ON public.screening_reasoning_steps(session_id);
CREATE INDEX idx_reasoning_steps_reference_id ON public.screening_reasoning_steps(reference_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_screening_progress_updated_at
BEFORE UPDATE ON public.screening_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for progress tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.screening_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.screening_reasoning_steps;