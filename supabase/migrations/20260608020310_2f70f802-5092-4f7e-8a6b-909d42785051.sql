CREATE POLICY "Super admins can read all whatsapp instances"
ON public.whatsapp_instances
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));