-- Fix the final function that needs search_path

-- Fix update_updated_at_column function to include proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
    -- Update the updated_at column
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;