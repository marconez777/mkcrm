-- Drop conflicting older overloads of enqueue_email, keeping only the latest 11-arg version.
-- The multiple overloads caused "function is not unique" errors when triggers called it with 9 args.
DROP FUNCTION IF EXISTS public.enqueue_email(uuid,text,text,text,jsonb,timestamp with time zone,uuid,text,boolean);
DROP FUNCTION IF EXISTS public.enqueue_email(uuid,text,text,text,jsonb,timestamp with time zone,uuid,text,boolean,text);