import { supabase } from "@/integrations/supabase/client";
import type { ServiceKind } from "@/hooks/useServiceTypes";

export type ServiceTypePatch = {
  label?: string;
  kind?: ServiceKind;
  color_hex?: string;
  default_duration_min?: number;
  active?: boolean;
  position?: number;
  slug?: string;
};

export type CreateServiceTypeInput = {
  clinic_id: string;
  label: string;
  kind: ServiceKind;
  color_hex: string;
  default_duration_min: number;
  slug?: string;
};

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function describeError(error: { code?: string; message: string } | null): string | null {
  if (!error) return null;
  if (error.code === "23505") return "Já existe um tipo com esse slug.";
  if (error.code === "23503")
    return "Tipo em uso por agendamentos. Desative em vez de excluir.";
  return error.message;
}

export async function createServiceType(
  input: CreateServiceTypeInput,
): Promise<{ id: string | null; error: string | null }> {
  const slug = input.slug?.trim() || slugify(input.label);
  if (!slug) return { id: null, error: "Slug inválido" };

  const { data: maxRow } = await supabase
    .from("appointment_service_types")
    .select("position")
    .eq("clinic_id", input.clinic_id)
    .eq("kind", input.kind)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("appointment_service_types")
    .insert({
      clinic_id: input.clinic_id,
      kind: input.kind,
      slug,
      label: input.label,
      color_hex: input.color_hex,
      default_duration_min: input.default_duration_min,
      position: nextPosition,
      active: true,
    })
    .select("id")
    .maybeSingle();
  return { id: data?.id ?? null, error: describeError(error) };
}

export async function updateServiceType(
  id: string,
  patch: ServiceTypePatch,
): Promise<{ error: string | null }> {
  const payload: ServiceTypePatch = { ...patch };
  if (payload.slug !== undefined) payload.slug = slugify(payload.slug);
  const { error } = await supabase
    .from("appointment_service_types")
    .update(payload)
    .eq("id", id);
  return { error: describeError(error) };
}

export async function deleteServiceType(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("appointment_service_types")
    .delete()
    .eq("id", id);
  return { error: describeError(error) };
}

export async function swapServiceTypePositions(
  a: { id: string; position: number },
  b: { id: string; position: number },
): Promise<{ error: string | null }> {
  const r1 = await supabase
    .from("appointment_service_types")
    .update({ position: b.position })
    .eq("id", a.id);
  if (r1.error) return { error: describeError(r1.error) };
  const r2 = await supabase
    .from("appointment_service_types")
    .update({ position: a.position })
    .eq("id", b.id);
  return { error: describeError(r2.error) };
}
