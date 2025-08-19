-- Create a function to make the first registered user an admin
CREATE OR REPLACE FUNCTION public.assign_first_user_as_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert admin role for the first user (if no admin exists yet)
  INSERT INTO public.user_roles (user_id, role)
  SELECT u.id, 'admin'::app_role
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id AND ur.role = 'admin'
  WHERE ur.user_id IS NULL
  ORDER BY u.created_at ASC
  LIMIT 1
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Also create a trigger to automatically assign admin role to first user
CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the first user and no admin exists
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table (since that's where user data goes after signup)
DROP TRIGGER IF EXISTS auto_assign_first_admin_trigger ON public.profiles;
CREATE TRIGGER auto_assign_first_admin_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_first_admin();