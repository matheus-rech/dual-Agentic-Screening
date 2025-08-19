-- Add timing and user decision tracking fields to ai_screening_log
ALTER TABLE ai_screening_log 
ADD COLUMN IF NOT EXISTS screening_start_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS screening_end_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS processing_duration_ms integer;

-- Create user_decisions table for manual review tracking
CREATE TABLE IF NOT EXISTS user_decisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES review_projects(id) ON DELETE CASCADE,
  reference_id uuid REFERENCES "references"(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  original_ai_decision text,
  user_decision text NOT NULL,
  decision_reason text,
  confidence_level integer CHECK (confidence_level >= 1 AND confidence_level <= 5),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create screening_runs table for versioning and history
CREATE TABLE IF NOT EXISTS screening_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES review_projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  run_name text NOT NULL,
  criteria_snapshot jsonb NOT NULL,
  total_references integer DEFAULT 0,
  completed_references integer DEFAULT 0,
  agreement_rate numeric,
  start_time timestamp with time zone DEFAULT now(),
  end_time timestamp with time zone,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  configuration jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE user_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_runs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_decisions
CREATE POLICY "Users can view their own decisions" ON user_decisions
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own decisions" ON user_decisions
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own decisions" ON user_decisions
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own decisions" ON user_decisions
FOR DELETE USING (user_id = auth.uid());

-- Create RLS policies for screening_runs
CREATE POLICY "Users can view their own screening runs" ON screening_runs
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own screening runs" ON screening_runs
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own screening runs" ON screening_runs
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own screening runs" ON screening_runs
FOR DELETE USING (user_id = auth.uid());

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_decisions_project_id ON user_decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_decisions_reference_id ON user_decisions(reference_id);
CREATE INDEX IF NOT EXISTS idx_screening_runs_project_id ON screening_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_screening_log_project_id ON ai_screening_log(project_id);

-- Add trigger for updated_at columns
CREATE TRIGGER update_user_decisions_updated_at
  BEFORE UPDATE ON user_decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_screening_runs_updated_at
  BEFORE UPDATE ON screening_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();