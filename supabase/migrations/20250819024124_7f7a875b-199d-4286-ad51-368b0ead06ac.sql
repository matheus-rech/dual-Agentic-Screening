-- Add timeframe fields to support complete PICO-TT (Population, Intervention, Comparator, Outcome, Type of study, Timeframe)

-- Add timeframe fields to review_projects table
ALTER TABLE public.review_projects 
ADD COLUMN IF NOT EXISTS timeframe_start text,
ADD COLUMN IF NOT EXISTS timeframe_end text,
ADD COLUMN IF NOT EXISTS timeframe_description text;

-- Add timeframe fields to screening_criteria table  
ALTER TABLE public.screening_criteria
ADD COLUMN IF NOT EXISTS timeframe_start text,
ADD COLUMN IF NOT EXISTS timeframe_end text,
ADD COLUMN IF NOT EXISTS timeframe_description text;

-- Add comments to document the complete PICO-TT structure
COMMENT ON COLUMN public.review_projects.population IS 'P - Population: Target population for the review';
COMMENT ON COLUMN public.review_projects.intervention IS 'I - Intervention: The intervention being studied';
COMMENT ON COLUMN public.review_projects.comparator IS 'C - Comparator: What the intervention is compared against';
COMMENT ON COLUMN public.review_projects.outcome IS 'O - Outcome: Primary outcomes of interest';
COMMENT ON COLUMN public.review_projects.study_designs IS 'T - Type of study: Acceptable study designs/types';
COMMENT ON COLUMN public.review_projects.timeframe_start IS 'T - Timeframe: Start date/period for study inclusion';
COMMENT ON COLUMN public.review_projects.timeframe_end IS 'T - Timeframe: End date/period for study inclusion';
COMMENT ON COLUMN public.review_projects.timeframe_description IS 'T - Timeframe: Additional description of time-related criteria';