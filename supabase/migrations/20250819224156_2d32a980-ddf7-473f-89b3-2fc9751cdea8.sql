-- Add dual_ai_review column to review_projects table
ALTER TABLE public.review_projects 
ADD COLUMN dual_ai_review boolean DEFAULT false;