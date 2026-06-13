// Helpers compartilhados para parsing/validação de datas extraídas pela IA.
// Aceita ISO 8601, DD/MM, DD/MM/AAAA, DD-MM-AAAA. Rejeita datas inválidas
// e datas no passado (com 12h de tolerância pra fuso).

const PAST_TOLERANCE_MS = 12 * 60 * 60 * 1000;

export function parseFutureDate(raw: unknown, now: Date = new Date()): Date | null {
  if (typeof raw !== "string") return null;
  const str = raw.trim();
  if (!str) return null;

  let d: Date | null = null;

  // ISO completo (com ou sem hora)
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const [, y, m, day, hh, mm, ss] = iso;
    const Y = +y, M = +m, D = +day;
    if (M < 1 || M > 12 || D < 1 || D > 31) return null;
    d = new Date(Date.UTC(Y, M - 1, D, +(hh ?? 12), +(mm ?? 0), +(ss ?? 0)));
    if (d.getUTCFullYear() !== Y || d.getUTCMonth() !== M - 1 || d.getUTCDate() !== D) return null;
  }

  // DD/MM/AAAA ou DD-MM-AAAA
  if (!d) {
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmy) {
      let [, dd, mm, yy] = dmy;
      let Y = +yy;
      if (Y < 100) Y += 2000;
      const M = +mm, D = +dd;
      if (M < 1 || M > 12 || D < 1 || D > 31) return null;
      d = new Date(Date.UTC(Y, M - 1, D, 12, 0, 0));
      if (d.getUTCFullYear() !== Y || d.getUTCMonth() !== M - 1 || d.getUTCDate() !== D) return null;
    }
  }

  // DD/MM (assume ano corrente; se já passou, próximo ano)
  if (!d) {
    const dm = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (dm) {
      const D = +dm[1], M = +dm[2];
      if (M < 1 || M > 12 || D < 1 || D > 31) return null;
      const Y = now.getUTCFullYear();
      let cand = new Date(Date.UTC(Y, M - 1, D, 12, 0, 0));
      if (cand.getTime() < now.getTime() - PAST_TOLERANCE_MS) {
        cand = new Date(Date.UTC(Y + 1, M - 1, D, 12, 0, 0));
      }
      if (cand.getUTCMonth() !== M - 1 || cand.getUTCDate() !== D) return null;
      d = cand;
    }
  }

  if (!d || isNaN(d.getTime())) return null;
  if (d.getTime() < now.getTime() - PAST_TOLERANCE_MS) return null;
  return d;
}

export function isFutureDateString(raw: unknown): boolean {
  return parseFutureDate(raw) !== null;
}
