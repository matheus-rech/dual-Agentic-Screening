-- Create user roles system for proper access control
CREATE TYPE public.app_role AS ENUM ('admin', 'researcher', 'user');

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Create function to check if current user has role
CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), _role);
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Only admins can manage roles" ON public.user_roles
FOR ALL USING (public.current_user_has_role('admin'));

-- Drop existing overly permissive policies on paper_references
DROP POLICY IF EXISTS "Allow authenticated users to delete references" ON public.paper_references;
DROP POLICY IF EXISTS "Allow authenticated users to insert references" ON public.paper_references;
DROP POLICY IF EXISTS "Allow authenticated users to update references" ON public.paper_references;

-- Create secure policies for paper_references
CREATE POLICY "Allow all users to view paper references" ON public.paper_references
FOR SELECT USING (true);

CREATE POLICY "Only admins can insert paper references" ON public.paper_references
FOR INSERT WITH CHECK (public.current_user_has_role('admin'));

CREATE POLICY "Only admins can update paper references" ON public.paper_references
FOR UPDATE USING (public.current_user_has_role('admin'))
WITH CHECK (public.current_user_has_role('admin'));

CREATE POLICY "Only admins can delete paper references" ON public.paper_references
FOR DELETE USING (public.current_user_has_role('admin'));

-- Add trigger for updated_at on user_roles
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert a default admin user (replace with actual admin email when known)
-- This should be updated after authentication is fully implemented
INSERT INTO public.user_roles (user_id, role) 
SELECT id, 'admin'::app_role 
FROM auth.users 
WHERE email = 'admin@example.com'  -- Update this with actual admin email
ON CONFLICT (user_id, role) DO NOTHING;