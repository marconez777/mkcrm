// Helpers para escapar o limite default de 1000 linhas por resposta do PostgREST.

const PAGE = 1000;

/**
 * Pagina por .range() até esgotar. `build` deve devolver um query builder do
 * supabase SEM .range/.limit. Ordem é preservada se você passou .order() no build.
 */
export async function fetchAllPaged<T>(
  build: () => any,
  pageSize = PAGE,
  hardCap = 100_000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (from < hardCap) {
    const to = from + pageSize - 1;
    const { data, error } = await build().range(from, to);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/**
 * Roda múltiplos .in(column, chunk) e concatena. Evita o teto de 1000 valores
 * no IN e URIs muito longas.
 */
export async function fetchAllByIn<T>(
  build: (chunk: any[]) => any,
  values: any[],
  chunkSize = 500,
): Promise<T[]> {
  const unique = Array.from(new Set(values.filter((v) => v !== null && v !== undefined)));
  if (unique.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    const slice = unique.slice(i, i + chunkSize);
    const { data, error } = await build(slice);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
  }
  return out;
}
