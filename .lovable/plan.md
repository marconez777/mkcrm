## Contexto

Já existem na base: tabela `tracking_sites`, edge functions `tracking-pixel`/`tracking-ingest`/`tracking-claim`, página `src/pages/SettingsTracking.tsx` (rota `/settings/tracking`), e `evolution-webhook` já chama `tracking-claim` ao criar lead (linhas 83-91). Falta apenas: criar a row do site, expor a página no menu, e te devolver o token.

## Plano

### 1. Inserir site no banco (Clínica ÓR — `cf038458-457d-4c1a-9ac4-c88c3c8353a1`)

```sql
INSERT INTO public.tracking_sites (clinic_id, name, domain, ingest_token)
VALUES (
  'cf038458-457d-4c1a-9ac4-c88c3c8353a1',
  'Clínica OHR — site institucional',
  'clinicaohrpsiquiatria.com',
  gen_random_uuid()
)
RETURNING id, ingest_token;
```

Depois te devolvo no chat:
- O `ingest_token` gerado
- A URL do pixel: `https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-pixel?t=<TOKEN>`
- O `<script>` pronto pra colar antes de `</body>`

### 2. Expor "Rastreamento" como aba em Configurações

Em `src/pages/Settings.tsx`:
- Adicionar `<TabsTrigger value="tracking">Rastreamento</TabsTrigger>` ao `TabsList` (e ajustar `grid-cols-N`).
- Adicionar `<TabsContent value="tracking">` que renderiza o conteúdo de `SettingsTracking` (extrair em componente reutilizável ou importar a página direto).
- Restringir aos não-`professional` (admin/owner), igual à aba "Importações".

A rota standalone `/settings/tracking` continua funcionando.

### 3. tracking-claim no webhook

Já está integrado em `supabase/functions/evolution-webhook/index.ts` (chamada fire-and-forget após criação de lead com o `ref` extraído da 1ª mensagem). Nenhuma alteração necessária — só confirmo no chat.

## Arquivos afetados

- `supabase/insert` (INSERT em `tracking_sites`)
- `src/pages/Settings.tsx` (nova aba)
- Possivelmente extrair o corpo de `SettingsTracking.tsx` em `src/components/settings/TrackingSitesPanel.tsx` para reuso entre rota e aba.
