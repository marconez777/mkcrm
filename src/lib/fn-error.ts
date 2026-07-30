import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * supabase.functions.invoke sempre devolve a mensagem genérica
 * "Edge Function returned a non-2xx status code". O motivo real vem no corpo
 * da resposta — este helper extrai isso.
 */
export async function fnErrorMessage(err: unknown, fallback = "Falha na operação"): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.clone().json();
      const msg = body?.error ?? body?.message;
      if (typeof msg === "string" && msg.trim()) return msg;
      if (msg && typeof msg === "object") return JSON.stringify(msg);
    } catch {
      try {
        const text = await err.context.clone().text();
        if (text?.trim()) return text.slice(0, 500);
      } catch {
        /* ignore */
      }
    }
  }
  const anyErr = err as { message?: string } | null;
  return anyErr?.message?.trim() || fallback;
}
