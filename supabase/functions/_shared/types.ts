// Shared response types for edge functions.
export type EdgeError = { error: string; detail?: string };

export type SyncLeadResult = {
  ok: true;
  imported: number;
  total: number;
  pages: number;
  full: boolean;
};

export type BackfillProgressEvent =
  | { type: "start"; lead_id: string }
  | { type: "page"; page: number; items: number; pageImported: number; imported: number; total: number }
  | { type: "lead_done"; lead_id: string; imported: number; total: number; pages: number }
  | { type: "done"; imported: number; total: number; pages: number; processed?: number; leads?: number }
  | { type: "error"; page?: number; status?: number; detail?: string };

export type BackfillAllResult = {
  ok: true;
  processed: number;
  totalImported: number;
  leads: number;
};

export type HealthResult = {
  ok: boolean;
  state?: string;
  webhook_ok?: boolean;
  detail?: string;
};
