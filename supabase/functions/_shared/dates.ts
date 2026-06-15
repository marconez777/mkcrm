// Helpers compartilhados para parsing/validação de datas extraídas pela IA.
// Aceita ISO 8601, DD/MM, DD/MM/AAAA, DD-MM-AAAA. Rejeita datas inválidas
// e datas no passado (com 12h de tolerância pra fuso).

const PAST_TOLERANCE_MS = 12 * 60 * 60 * 1000;

function hasExplicitOffset(s: string): boolean {
  return /([zZ]|[+-]\d{2}:?\d{2})$/.test(s.trim());
}

// Converte wall-clock (Y,M,D,h,m,s) num determinado tz para o instante UTC correto,
// resolvendo DST via Intl.DateTimeFormat. Truque: cria o instante "como se fosse UTC",
// mede como ele aparece no tz e corrige pela diferença.
function wallClockToUTC(
  Y: number, M: number, D: number, h: number, m: number, s: number, tz: string,
): Date {
  const naiveUTC = Date.UTC(Y, M - 1, D, h, m, s);
  if (!tz || tz === "UTC") return new Date(naiveUTC);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(naiveUTC));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const tzAsUTC = Date.UTC(+map.year, +map.month - 1, +map.day, (+map.hour) % 24, +map.minute, +map.second);
  const offset = tzAsUTC - naiveUTC; // quanto o tz está adiantado em relação ao UTC
  return new Date(naiveUTC - offset);
}

/**
 * Parse de data futura interpretando strings "naive" (sem offset) como wall-clock
 * no fuso `tz` fornecido. Strings ISO com offset/Z são respeitadas como instante absoluto.
 */
export function parseFutureDateInTZ(
  raw: unknown,
  tz: string,
  now: Date = new Date(),
): Date | null {
  if (typeof raw !== "string") return null;
  const str = raw.trim();
  if (!str) return null;

  let d: Date | null = null;

  // ISO (com ou sem hora)
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const [, y, m, day, hh, mm, ss] = iso;
    const Y = +y, M = +m, D = +day;
    if (M < 1 || M > 12 || D < 1 || D > 31) return null;
    const H = +(hh ?? "12"), Mi = +(mm ?? "0"), S = +(ss ?? "0");
    if (hasExplicitOffset(str)) {
      const parsed = new Date(str);
      if (isNaN(parsed.getTime())) return null;
      d = parsed;
    } else {
      d = wallClockToUTC(Y, M, D, H, Mi, S, tz);
      // sanidade: wall-clock no tz tem que casar com o que pedimos
      const check = new Intl.DateTimeFormat("en-US", {
        timeZone: tz || "UTC", hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(d);
      const cm: Record<string, string> = {};
      for (const p of check) cm[p.type] = p.value;
      if (+cm.year !== Y || +cm.month !== M || +cm.day !== D) return null;
    }
  }

  // DD/MM/AAAA ou DD-MM-AAAA — meio-dia local do tz
  if (!d) {
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmy) {
      const [, dd, mm, yy] = dmy;
      let Y = +yy;
      if (Y < 100) Y += 2000;
      const M = +mm, D = +dd;
      if (M < 1 || M > 12 || D < 1 || D > 31) return null;
      d = wallClockToUTC(Y, M, D, 12, 0, 0, tz);
    }
  }

  // DD/MM (assume ano corrente; se já passou, próximo ano)
  if (!d) {
    const dm = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (dm) {
      const D = +dm[1], M = +dm[2];
      if (M < 1 || M > 12 || D < 1 || D > 31) return null;
      const Y = now.getUTCFullYear();
      let cand = wallClockToUTC(Y, M, D, 12, 0, 0, tz);
      if (cand.getTime() < now.getTime() - PAST_TOLERANCE_MS) {
        cand = wallClockToUTC(Y + 1, M, D, 12, 0, 0, tz);
      }
      d = cand;
    }
  }

  if (!d || isNaN(d.getTime())) return null;
  if (d.getTime() < now.getTime() - PAST_TOLERANCE_MS) return null;
  return d;
}

/**
 * Compat: parse "naive" como UTC (comportamento legado). Novas chamadas devem
 * preferir `parseFutureDateInTZ(raw, "America/Sao_Paulo")`.
 */
export function parseFutureDate(raw: unknown, now: Date = new Date()): Date | null {
  return parseFutureDateInTZ(raw, "UTC", now);
}

export function isFutureDateString(raw: unknown): boolean {
  return parseFutureDate(raw) !== null;
}
