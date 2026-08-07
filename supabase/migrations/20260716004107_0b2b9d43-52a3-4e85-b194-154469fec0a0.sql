
-- Junção N:M entre pipelines e whatsapp_instances
CREATE TABLE public.pipeline_whatsapp_instances (
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  whatsapp_instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pipeline_id, whatsapp_instance_id),
  -- uma instância pertence a no máximo um pipeline por clínica
  CONSTRAINT pipeline_wa_inst_unique_per_clinic UNIQUE (clinic_id, whatsapp_instance_id)
);

CREATE INDEX idx_pwi_clinic_instance ON public.pipeline_whatsapp_instances (clinic_id, whatsapp_instance_id);
CREATE INDEX idx_pwi_pipeline ON public.pipeline_whatsapp_instances (pipeline_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_whatsapp_instances TO authenticated;
GRANT ALL ON public.pipeline_whatsapp_instances TO service_role;

ALTER TABLE public.pipeline_whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic members read pipeline_wa_instances"
  ON public.pipeline_whatsapp_instances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.clinic_id = pipeline_whatsapp_instances.clinic_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "clinic members manage pipeline_wa_instances"
  ON public.pipeline_whatsapp_instances FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.clinic_id = pipeline_whatsapp_instances.clinic_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.clinic_id = pipeline_whatsapp_instances.clinic_id
        AND cm.user_id = auth.uid()
    )
  );

COMMENT ON COLUMN public.pipelines.whatsapp_instance_id IS
  'DEPRECATED: mantido para retro-compat. Fonte de verdade é public.pipeline_whatsapp_instances. Ainda usado como instância "primária" para envios/broadcasts.';

-- Backfill dos vínculos atuais 1:1
INSERT INTO public.pipeline_whatsapp_instances (pipeline_id, whatsapp_instance_id, clinic_id)
SELECT p.id, p.whatsapp_instance_id, p.clinic_id
  FROM public.pipelines p
 WHERE p.whatsapp_instance_id IS NOT NULL
ON CONFLICT DO NOTHING;
