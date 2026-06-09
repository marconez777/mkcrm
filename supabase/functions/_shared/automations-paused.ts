// Kill-switch helper: returns the set of clinic IDs that have paused
// all automated outbound sends (sequences / automations / scheduled / replies).
// Flag stored in clinics.settings.automations_paused (boolean).
export async function getPausedClinicIds(supabase: any): Promise<Set<string>> {
  try {
    const { data } = await supabase
      .from("clinics")
      .select("id, settings")
      .eq("status", "active");
    const set = new Set<string>();
    for (const c of (data ?? []) as any[]) {
      if (c?.settings?.automations_paused === true) set.add(c.id);
    }
    return set;
  } catch {
    return new Set();
  }
}
