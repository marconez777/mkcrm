## Integração Eduzz — webhook por plano

Cada produto na Eduzz tem o seu próprio campo "Entrega Customizada". Então vamos gerar **uma URL diferente pra cada plano**. Você cola a URL do Pro no produto Pro da Eduzz, a URL do Supreme no produto Supreme, etc.

---

### Como vai funcionar

URLs assim (uma por plano):
```
https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/eduzz-webhook/pro
https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/eduzz-webhook/supreme
```

O plano vai no **path** (`/pro`, `/supreme`). Vantagem: zero configuração de produto — você só copia a URL certa pro produto certo na Eduzz.

Fluxo quando alguém compra:
1. Cliente paga no checkout da Eduzz.
2. Eduzz manda POST pra URL do plano (ex.: `/pro`) com email, nome, CPF, valor, etc.
3. Sistema:
   - Lê o `code` do plano do path (`pro`, `supreme`, ...).
   - Valida `edz_cli_origin_secret` contra `EDUZZ_ORIGIN_SECRET`.
   - Confere `fat_status=3` (Paga) e `type=create`.
   - Procura cliente pelo email:
     - **Já tem conta** → ativa o plano na clínica existente.
     - **Email novo** → cria clínica + manda convite por email (clínica já no plano correto).
   - Se `type=remove` (reembolso/cancelamento/atraso) → volta clínica pra Free.
4. Registra tudo em `eduzz_purchases`.
5. Sempre responde HTTP 200.

---

### O que será construído

**1. Migration — 1 tabela**
- `eduzz_purchases`: `plan_code`, `fat_cod`, `cnt_cod`, `cli_email`, `cli_name`, `cli_taxnumber`, `type`, `fat_status`, `valor`, `clinic_id`, `payload` (jsonb), `processed_status` (`ok`/`ignored`/`error`), `error_msg`. Único `(fat_cod, cnt_cod, type)` → idempotência. RLS só super_admin.

(Não precisa mais de `eduzz_product_plans` — plano vem pela URL.)

**2. Edge function `eduzz-webhook`** (pública, sem JWT)
- Lê `plan_code` do path (último segmento). Valida que existe em `plans.code` e que `is_public=true` (ou inclui free). Sem match → 200 + log `error:invalid_plan`.
- Valida `origin_secret` (constant-time). Falhou → 200 + log `error:bad_secret`.
- Idempotência via unique constraint (`ON CONFLICT DO NOTHING`).
- Order bump (`edz_order_bump_item=true`) → `ignored:order_bump`.
- `type=create` + `fat_status=3`:
  - Email existe → atualiza `clinics.plan_id` + nova `clinic_subscriptions` (`source='eduzz'`, metadata com `fat_cod`).
  - Email novo → cria auth user + clínica + membership owner + aplica plano. Convite vai por email automaticamente.
- `type=remove` → aplica `free` na clínica; marca subscription como `canceled`.
- Sempre 200; erros tratados viram linha em `eduzz_purchases` com motivo.

**3. Helper `_shared/apply-plan.ts`** — extrai lógica de aplicar plano (hoje em `admin-apply-plan`) pra reusar.

**4. Tela `/admin/integrations/eduzz`** (nova entrada no AdminShell)
- Card **URLs por plano**: lista todos os planos públicos com URL pronta + botão copiar pra cada um.
  ```
  Pro      → https://.../eduzz-webhook/pro      [copiar]
  Supreme  → https://.../eduzz-webhook/supreme  [copiar]
  ```
- Card **Origin Secret**: status + botão "Configurar".
- Card **Compras recebidas** (últimas 100): plano, email, valor, status, data; tooltip com motivo; botão "reprocessar" em erros.

**5. Secret `EDUZZ_ORIGIN_SECRET`** — vou pedir pra você colar (pega em https://orbita.eduzz.com/producer/config-api).

---

### O que VOCÊ vai fazer depois

1. Colar a `origin_secret` quando eu pedir.
2. Abrir a tela `/admin/integrations/eduzz`, copiar a URL de cada plano.
3. Na Eduzz: pra cada produto (Pro, Supreme...), abrir "Entrega Customizada", colar a URL correspondente, salvar.
4. Fazer uma venda de teste pra ver chegando na tela de compras.

---

### Detalhes técnicos
- URL final tem o plano no path: `/functions/v1/eduzz-webhook/<plan_code>`.
- Sem JWT (público — Eduzz não manda auth header).
- Criação de clínica reusa lógica do `clinic-create-user`.

### Fora do escopo
- Sincronização contínua de status de contrato (assinaturas) além de create/remove.
- Validação alternativa via `sid`/`nsid`.
- Multi-produtor.
