-- Enterprise-Grade Scientific Research Platform Schema
-- Phase 1: Advanced Research Methodology & Quality Assurance

-- Create systematic review protocol management
CREATE TABLE IF NOT EXISTS public.systematic_review_protocols (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  protocol_version text NOT NULL DEFAULT '1.0',
  title text NOT NULL,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  pico_framework jsonb NOT NULL DEFAULT '{}'::jsonb, -- Population, Intervention, Comparator, Outcome
  search_strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  inclusion_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  exclusion_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_extraction_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_assessment_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  statistical_analysis_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  protocol_registration_info jsonb DEFAULT NULL, -- PROSPERO, etc.
  ethics_approval_info jsonb DEFAULT NULL,
  funding_information jsonb DEFAULT NULL,
  conflicts_of_interest jsonb DEFAULT '[]'::jsonb,
  protocol_status text NOT NULL DEFAULT 'draft', -- draft, registered, active, completed
  protocol_document_url text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_at timestamp with time zone,
  approved_by uuid
);

-- Create inter-rater reliability tracking
CREATE TABLE IF NOT EXISTS public.inter_rater_reliability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  screening_phase text NOT NULL, -- title_abstract, full_text, data_extraction
  reviewer_1_id uuid NOT NULL,
  reviewer_2_id uuid NOT NULL,
  total_references integer NOT NULL DEFAULT 0,
  agreed_references integer NOT NULL DEFAULT 0,
  disagreed_references integer NOT NULL DEFAULT 0,
  kappa_coefficient numeric(5,4),
  percent_agreement numeric(5,2),
  positive_agreement numeric(5,2),
  negative_agreement numeric(5,2),
  calculation_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create bias assessment framework
CREATE TABLE IF NOT EXISTS public.bias_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id uuid NOT NULL,
  assessment_tool text NOT NULL, -- ROB2, ROBINS-I, Newcastle-Ottawa, etc.
  domain_scores jsonb NOT NULL DEFAULT '{}'::jsonb, -- per domain scores
  overall_risk text NOT NULL, -- low, some_concerns, high
  support_for_judgement jsonb NOT NULL DEFAULT '{}'::jsonb,
  assessor_id uuid NOT NULL,
  assessment_date timestamp with time zone NOT NULL DEFAULT now(),
  peer_reviewed boolean DEFAULT false,
  peer_reviewer_id uuid,
  peer_review_date timestamp with time zone,
  peer_review_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create data extraction framework
CREATE TABLE IF NOT EXISTS public.data_extractions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id uuid NOT NULL,
  project_id uuid NOT NULL,
  extraction_form_version text NOT NULL,
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  extractor_id uuid NOT NULL,
  extraction_date timestamp with time zone NOT NULL DEFAULT now(),
  extraction_status text NOT NULL DEFAULT 'draft', -- draft, completed, verified
  quality_score numeric(3,2),
  data_completeness_score numeric(3,2),
  verification_status text DEFAULT 'pending', -- pending, verified, discrepancy
  verifier_id uuid,
  verification_date timestamp with time zone,
  verification_notes text,
  discrepancies jsonb DEFAULT '[]'::jsonb,
  resolved_discrepancies jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create quality assurance tracking
CREATE TABLE IF NOT EXISTS public.quality_assurance_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  metric_type text NOT NULL, -- screening_accuracy, extraction_completeness, bias_assessment_consistency
  metric_value numeric(10,4) NOT NULL,
  metric_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  measurement_date timestamp with time zone NOT NULL DEFAULT now(),
  measured_by uuid,
  benchmark_value numeric(10,4),
  meets_threshold boolean DEFAULT false,
  improvement_actions jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create statistical analysis results storage
CREATE TABLE IF NOT EXISTS public.statistical_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  analysis_type text NOT NULL, -- meta_analysis, network_meta_analysis, descriptive_analysis
  analysis_name text NOT NULL,
  included_references uuid[] NOT NULL DEFAULT '{}',
  outcome_measures jsonb NOT NULL DEFAULT '[]'::jsonb,
  statistical_method text NOT NULL,
  effect_measures jsonb NOT NULL DEFAULT '{}'::jsonb, -- effect sizes, confidence intervals
  heterogeneity_measures jsonb DEFAULT '{}'::jsonb, -- I2, Chi2, Tau2
  subgroup_analyses jsonb DEFAULT '[]'::jsonb,
  sensitivity_analyses jsonb DEFAULT '[]'::jsonb,
  publication_bias_assessment jsonb DEFAULT '{}'::jsonb,
  forest_plot_data jsonb DEFAULT '{}'::jsonb,
  analysis_code text, -- R, Stata, or other analysis code
  analysis_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  interpretation text,
  limitations text,
  conducted_by uuid NOT NULL,
  reviewed_by uuid,
  analysis_date timestamp with time zone NOT NULL DEFAULT now(),
  review_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create compliance and audit framework
CREATE TABLE IF NOT EXISTS public.compliance_checkpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  checkpoint_type text NOT NULL, -- prisma, cochrane, prospero, institutional
  compliance_framework text NOT NULL, -- PRISMA 2020, Cochrane Handbook, etc.
  checkpoint_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  completion_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_score numeric(5,2),
  last_assessment_date timestamp with time zone NOT NULL DEFAULT now(),
  assessed_by uuid,
  compliance_report jsonb DEFAULT '{}'::jsonb,
  action_items jsonb DEFAULT '[]'::jsonb,
  next_assessment_due timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create comprehensive audit log for research integrity
CREATE TABLE IF NOT EXISTS public.research_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action_type text NOT NULL, -- protocol_change, screening_decision, data_extraction, analysis
  action_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  affected_entity_type text NOT NULL, -- reference, protocol, analysis
  affected_entity_id uuid,
  before_state jsonb DEFAULT '{}'::jsonb,
  after_state jsonb DEFAULT '{}'::jsonb,
  justification text,
  peer_witnessed boolean DEFAULT false,
  witness_id uuid,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  session_id uuid,
  ip_address text,
  user_agent text,
  regulatory_flag boolean DEFAULT false,
  retention_class text DEFAULT 'standard' -- standard, extended, permanent
);

-- Enable RLS on all new tables
ALTER TABLE public.systematic_review_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_rater_reliability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bias_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_assurance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistical_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for project-based access
CREATE POLICY "Users can manage protocols for own projects" ON public.systematic_review_protocols
FOR ALL USING (EXISTS (SELECT 1 FROM review_projects WHERE review_projects.id = project_id AND review_projects.user_id = auth.uid()));

CREATE POLICY "Users can view reliability data for own projects" ON public.inter_rater_reliability
FOR ALL USING (EXISTS (SELECT 1 FROM review_projects WHERE review_projects.id = project_id AND review_projects.user_id = auth.uid()));

CREATE POLICY "Users can manage bias assessments for own projects" ON public.bias_assessments
FOR ALL USING (EXISTS (SELECT 1 FROM references r JOIN review_projects rp ON r.project_id = rp.id WHERE r.id = reference_id AND rp.user_id = auth.uid()));

CREATE POLICY "Users can manage data extractions for own projects" ON public.data_extractions
FOR ALL USING (EXISTS (SELECT 1 FROM review_projects WHERE review_projects.id = project_id AND review_projects.user_id = auth.uid()));

CREATE POLICY "Users can view quality metrics for own projects" ON public.quality_assurance_metrics
FOR ALL USING (EXISTS (SELECT 1 FROM review_projects WHERE review_projects.id = project_id AND review_projects.user_id = auth.uid()));

CREATE POLICY "Users can manage analyses for own projects" ON public.statistical_analyses
FOR ALL USING (EXISTS (SELECT 1 FROM review_projects WHERE review_projects.id = project_id AND review_projects.user_id = auth.uid()));

CREATE POLICY "Users can view compliance for own projects" ON public.compliance_checkpoints
FOR ALL USING (EXISTS (SELECT 1 FROM review_projects WHERE review_projects.id = project_id AND review_projects.user_id = auth.uid()));

CREATE POLICY "Users can view audit logs for own projects" ON public.research_audit_log
FOR SELECT USING (EXISTS (SELECT 1 FROM review_projects WHERE review_projects.id = project_id AND review_projects.user_id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_protocols_project_id ON public.systematic_review_protocols(project_id);
CREATE INDEX idx_reliability_project_phase ON public.inter_rater_reliability(project_id, screening_phase);
CREATE INDEX idx_bias_reference_tool ON public.bias_assessments(reference_id, assessment_tool);
CREATE INDEX idx_extractions_project_status ON public.data_extractions(project_id, extraction_status);
CREATE INDEX idx_qa_metrics_project_type ON public.quality_assurance_metrics(project_id, metric_type);
CREATE INDEX idx_analyses_project_type ON public.statistical_analyses(project_id, analysis_type);
CREATE INDEX idx_compliance_project_type ON public.compliance_checkpoints(project_id, checkpoint_type);
CREATE INDEX idx_audit_project_timestamp ON public.research_audit_log(project_id, timestamp DESC);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    -- Update the updated_at column
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_protocols_updated_at BEFORE UPDATE ON public.systematic_review_protocols FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bias_assessments_updated_at BEFORE UPDATE ON public.bias_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_data_extractions_updated_at BEFORE UPDATE ON public.data_extractions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_statistical_analyses_updated_at BEFORE UPDATE ON public.statistical_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_compliance_checkpoints_updated_at BEFORE UPDATE ON public.compliance_checkpoints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();