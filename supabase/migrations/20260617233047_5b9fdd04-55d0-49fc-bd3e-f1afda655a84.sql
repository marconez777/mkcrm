
CREATE TABLE public.lead_reclassify_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  batch_tag text NOT NULL,
  current_stage_id uuid NOT NULL,
  proposed_stage_id uuid NOT NULL,
  proposed_custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric NOT NULL,
  reasoning text NOT NULL,
  model text NOT NULL,
  tokens_in int,
  tokens_out int,
  cost_usd numeric,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','applied','rejected','skipped','error')),
  applied_at timestamptz,
  applied_by uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lrp_clinic_status ON public.lead_reclassify_proposals (clinic_id, status);
CREATE INDEX idx_lrp_lead ON public.lead_reclassify_proposals (lead_id);
CREATE INDEX idx_lrp_batch ON public.lead_reclassify_proposals (batch_tag);

GRANT SELECT, UPDATE ON public.lead_reclassify_proposals TO authenticated;
GRANT ALL ON public.lead_reclassify_proposals TO service_role;

ALTER TABLE public.lead_reclassify_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin reads proposals"
  ON public.lead_reclassify_proposals FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin updates proposals"
  ON public.lead_reclassify_proposals FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_lrp_set_updated_at
  BEFORE UPDATE ON public.lead_reclassify_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lead_reclassify_snapshot_2026_06 (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  custom_fields jsonb NOT NULL,
  snapshotted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_reclassify_snapshot_2026_06 TO authenticated;
GRANT ALL ON public.lead_reclassify_snapshot_2026_06 TO service_role;
ALTER TABLE public.lead_reclassify_snapshot_2026_06 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin reads snapshot"
  ON public.lead_reclassify_snapshot_2026_06 FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_reclassify_proposal(_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO p FROM public.lead_reclassify_proposals WHERE id = _proposal_id;
  IF p IS NULL THEN RAISE EXCEPTION 'proposal_not_found'; END IF;
  IF p.status <> 'pending' THEN RAISE EXCEPTION 'proposal_not_pending: %', p.status; END IF;

  UPDATE public.leads
     SET stage_id = p.proposed_stage_id,
         custom_fields = COALESCE(custom_fields, '{}'::jsonb) || p.proposed_custom_fields,
         updated_at = now()
   WHERE id = p.lead_id;

  UPDATE public.lead_stage_history
     SET reason = 'reclassify_deep:' || p.id::text,
         source = 'admin_reclassify',
         metadata = jsonb_build_object(
           'proposal_id', p.id,
           'confidence', p.confidence,
           'model', p.model,
           'applied_by', uid
         )
   WHERE id = (
     SELECT id FROM public.lead_stage_history
      WHERE lead_id = p.lead_id ORDER BY moved_at DESC LIMIT 1
   );

  INSERT INTO public.lead_events (clinic_id, lead_id, type, payload)
  VALUES (p.clinic_id, p.lead_id, 'stage_reclassified_deep',
          jsonb_build_object('proposal_id', p.id,
                             'from_stage_id', p.current_stage_id,
                             'to_stage_id', p.proposed_stage_id,
                             'confidence', p.confidence,
                             'applied_by', uid));

  UPDATE public.lead_reclassify_proposals
     SET status = 'applied', applied_at = now(), applied_by = uid
   WHERE id = p.id;

  RETURN jsonb_build_object('ok', true, 'lead_id', p.lead_id, 'stage_id', p.proposed_stage_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_reclassify_proposal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_reclassify_proposal(_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.lead_reclassify_proposals
     SET status = 'rejected', applied_at = now(), applied_by = uid
   WHERE id = _proposal_id AND status = 'pending';
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_reclassify_proposal(uuid) TO authenticated;
