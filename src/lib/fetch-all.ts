// Helper para buscar todas as linhas além do limite padrão (1000) do PostgREST.
// Usa .range() em páginas até esgotar.
const PAGE = 1000;

export async function fetchAllPaged<T>(
  build: () => any, // factory que retorna um query builder do supabase (sem range/limit)
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
