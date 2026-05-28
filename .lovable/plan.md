## Problema

1. **Segmento limita a 1000 destinatários**: a contagem (`counts[s.id]`) e o preview usam `supabase.rpc("resolve_email_segment", ...)` — RPC do PostgREST também respeita o limite default de 1000 linhas por resposta. Mesmo que 4503 contatos estejam vinculados em `email_segment_contacts`, o RPC retorna só os primeiros 1000.

2. **Save sem loader**: o botão "Salvar" não tem estado de loading, e com 4000+ linhas o insert demora vários segundos sem feedback visual.

3. **Insert único de 4000+ linhas**: pode dar timeout/erro PostgREST. Vou enviar em chunks de 500.

## Plano

Editar `src/pages/email/EmailSegments.tsx`:

1. **Contagem real (sem limite 1000)**: na função `load()`, em vez de chamar o RPC `resolve_email_segment` e contar emails, usar uma contagem direta:
   - Para segmentos `static`: `supabase.from("email_segment_contacts").select("*", { count: "exact", head: true }).eq("segment_id", s.id)` — retorna count exato sem trazer linhas.
   - Para segmentos `dynamic`: manter RPC mas embrulhar com `.range(0, 99999)` (PostgREST honra range em RPC) OU contar via paginação. Como dinâmicos raramente passam de 1000 hoje, aplicar `.range(0, 49999)` no RPC já resolve.

2. **Preview do segmento salvo** (`preview()` para editing): aplicar mesmo `.range(0, 49999)` no RPC de `resolve_email_segment` para não cortar em 1000.

3. **Loader no Save**:
   - Adicionar state `saving: boolean`.
   - `setSaving(true)` no início de `save()`, `false` no `finally`.
   - Desabilitar botão e mostrar `<Loader2 className="animate-spin" />Salvando…` enquanto `saving`.
   - Também desabilitar botão "Cancelar" durante save.

4. **Insert em chunks**: dividir `rows` em chunks de 500 e fazer inserts sequenciais para evitar payload gigante / timeouts.

Nenhuma mudança em schema/RLS — só frontend.