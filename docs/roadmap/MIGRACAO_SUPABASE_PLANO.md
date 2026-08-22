---
title: "Plano de migração — Lovable Cloud → Supabase próprio"
topic: architecture
kind: roadmap
audience: both
status: em-execucao
updated: 2026-08-22
summary: "Plano executável de migração do backend para um projeto Supabase próprio, agora viável porque o Lovable passou a oferecer export oficial de banco (pg_dump, teto de 5 GB). Método: restaurar o dump, não reconstruir o schema. Contém o inventário das 12 categorias que precisam atravessar, os riscos específicos deste projeto (pixel e formulários embutidos em sites de terceiros, webhooks da Evolution, 40 crons com URL e chave embutidas, dependência do gateway de IA do Lovable) e a janela de cutover."
related_docs:
  - docs/roadmap/MIGRACAO_SUPABASE.md
  - docs/roadmap/CLOUD_COST_REDUCTION.md
  - docs/pipeline/runtime/TRIGGERS_AUDIT.md
---

# Plano de migração — Lovable Cloud → Supabase próprio

> Substitui o [MIGRACAO_SUPABASE.md](./MIGRACAO_SUPABASE.md), descartado em
> 13/08/2026. O que mudou: **existe export oficial de banco** (Cloud → Advanced
> settings → Export project data), um `pg_dump` completo de estrutura e dados
> com teto de 5 GB e um por 24 h. A pergunta §4.1 daquele documento — "dá para
> obter um dump?" — está respondida com sim. O método deixa de ser exportação
> tabela a tabela por CSV e passa a ser **restore**.

## 1. Por que agora

O motivo não é custo, é acesso. Hoje:

- toda leitura de banco é copiar query → colar no SQL Editor → exportar CSV;
- deploy de edge function depende de pedir ao agente do Lovable;
- não há verificação automatizável, nem `pg_dump` para versionar o schema real;
- o repositório **não reproduz a produção** (achado de 13/08, ainda válido).

Com projeto próprio: connection string, CLI, `supabase db dump` para versionar o
schema de verdade, deploy de function por comando, backups diários com PITR,
painel de performance e branching.

O gatilho imediato foi o alerta de recursos de 22/08 (disco 6,48/8 GB, IO budget
em 100%), tratado em [CLOUD_COST_REDUCTION](./CLOUD_COST_REDUCTION.md). A
limpeza da Fase 1 resolveu o sintoma e é **pré-requisito** desta migração: sem
ela o banco não cabe no teto de 5 GB do export.

## 2. Estratégia: restaurar, não reconstruir

A documentação do Lovable orienta "exportar os dados, conectar o novo backend e
pedir ao Lovable para reconstruir o schema". **Não é o que vamos fazer.**
Reconstruir significa reaplicar as 303 migrations, que já se sabe divergirem da
produção. O caminho é restaurar o dump inteiro no projeto novo e usar a produção
atual como régua de conferência.

```
export oficial (pg_dump)  ──►  projeto Supabase novo  ──►  fixups  ──►  conferência  ──►  cutover
        │                                                     │
        └─ storage, secrets, edge functions e crons            └─ reescrever URL/chaves do projeto antigo
           NÃO vêm no dump: tratados à parte
```

## 3. O que precisa atravessar — 12 categorias

| # | Categoria | Vem no export? | Como resolve |
|---|---|---|---|
| 1 | Schema public (141 tabelas, 280 funções, 118 triggers, 204 policies) | ✅ | restore |
| 2 | Dados | ✅ | restore |
| 3 | Sequences com valor corrente | ✅ | conferir em M01 §3 |
| 4 | Usuários de auth (26) com hash de senha e identidades | ✅ (conferir) | restore + passo de correção de FK das identities |
| 5 | Linhas de `cron.job` (40 jobs) | ⚠️ parcial | recriar com URL e chave **novas** |
| 6 | Metadados de storage (4 buckets) | ✅ | restore |
| 7 | Arquivos de storage | ❌ | baixar pela tela Storage, subir por CLI |
| 8 | Código das 105 edge functions | ❌ (está no repo) | `supabase functions deploy` |
| 9 | Secrets das functions (17 nomes) | ❌ por design | redigitar no projeto novo |
| 10 | Publicação de realtime (~20 tabelas) + REPLICA IDENTITY | ⚠️ | script explícito pós-restore |
| 11 | Settings de banco (`app.settings.*`, `custom.*`) | ❌ | `ALTER DATABASE ... SET` |
| 12 | Extensões (pg_cron, pg_net, vector, pgcrypto) | ⚠️ | habilitar antes do restore |

## 4. Riscos específicos deste projeto

Os cinco primeiros não aparecem em nenhum guia genérico de migração. São o que
pode quebrar silenciosamente.

### R1 🔴 Pixel e formulários embutidos em sites de terceiros

`SettingsForms.tsx:240-241` entrega ao cliente para colar no site dele:

```html
<script async src="https://<ref>.supabase.co/functions/v1/forms-snippet?token=..."></script>
<script async src="https://<ref>.supabase.co/functions/v1/tracking-pixel?project_id=..."></script>
```

O host está **dentro do HTML de sites que não controlamos**. Trocar de projeto
mata a captação de formulário e o rastreamento desses sites, sem erro visível:
os leads simplesmente param de chegar.

- **Mitigação obrigatória:** levantar a lista (M05 §4 e §5) e reembutir o script
  em cada site na janela de cutover.
- **Mitigação estrutural:** servir esses dois endpoints por **domínio próprio**
  (`t.<dominio>` via Cloudflare Worker ou custom domain do Supabase, +US$ 10/mês)
  e reembutir uma última vez. A partir daí nenhuma migração futura quebra sites
  de cliente.

### R2 🔴 Webhooks da Evolution ficam gravados no servidor Evolution

`evolution-provision/index.ts:63` registra na Evolution
`${SUPABASE_URL}/functions/v1/evolution-webhook?token=<token por instância>`.
Esse endereço vive **na Evolution**, não no nosso banco. Depois do cutover, toda
instância precisa de novo `setWebhook` apontando para o projeto novo,
preservando o `webhook_token` de cada uma (que vem no dump). Enquanto isso não
for feito, **nenhuma mensagem de WhatsApp entra**.

### R3 🟠 Os 40 crons carregam URL e chave anon embutidas

Dois exemplos vindos das migrations: `automations-tick-every-5-min` tem a anon
key inteira no corpo do `net.http_post`; `dispatch_pipeline_classifiers()` tem a
URL e a chave dentro do código da função. Outros usam
`current_setting('app.settings.service_role_key')` e
`current_setting('custom.project_ref')`, que precisam ser setados no banco novo
com `ALTER DATABASE`. Todos os 40 precisam ser reescritos — M03 §1 traz o
comando completo de cada um.

### R4 🟠 O classificador roda no gateway de IA do Lovable

`_shared/lovable-ai.ts` → `_shared/classifier-ai.ts` e
`_template_pipeline_classify/agent.ts` chamam `https://ai.gateway.lovable.dev/v1`
com `LOVABLE_API_KEY`. Remover o Cloud **não** deve derrubar isso enquanto o
projeto Lovable existir num plano pago, mas é uma dependência externa que passa
a valer para o pipeline inteiro da ÓR.

- **Verificar no ensaio (F2)**, não no cutover.
- **Plano B pronto:** `_shared/ai.ts` já fala OpenAI e Gemini direto; trocar o
  provider do classificador é configuração, não reescrita.

### R5 🟠 Sessões caem e chaves públicas mudam

O JWT secret do projeto novo é outro: todas as sessões ativas morrem e os 26
usuários precisam **logar de novo** (a senha continua a mesma, se os hashes
vierem — conferir em M04 §1). A anon key e a service_role key também mudam:
qualquer integração externa que use a anon key atual quebra.

### R6 🔴 Governança pós-migração (agravado pela decisão de 22/08)

Com o front permanecendo no Lovable (§8), o agente do Lovable **também escreve
migrations** no Supabase próprio. Sem regra, o drift entre repositório e
produção — o achado que inviabilizou o plano de 13/08 — volta em semanas.

Regra a valer a partir do cutover:

| Quem | Pode | Não pode |
|---|---|---|
| Agente do Lovable | UI, componentes, páginas, chamadas ao client | criar/alterar tabela, função, trigger, policy, cron |
| CLI (nós) | todo o DDL, via migration versionada e `supabase db push` | — |

Sustentação: `supabase db dump` agendado, versionado no repo. Qualquer diferença
entre o dump e as migrations é drift e vira issue. Isso é o que fecha o buraco de
13/08 — e só funciona se a regra for respeitada de fato.

### R7 🟠 O ato de conectar o Supabase próprio ao Lovable

A documentação do Lovable é explícita: *"There is no automatic migration between
the built-in backend (Cloud) and your own Supabase project, in either direction"*,
e orienta "conectar o novo e pedir ao Lovable para reconstruir o schema".
**Não é o que faremos** — o schema já vai estar restaurado. Ao conectar:

- o Lovable pode sobrescrever `src/integrations/supabase/client.ts` e o env;
- não deixar o agente "criar o schema"; a primeira instrução ao conectar é que
  o banco já existe e está populado.

Fazer esse passo **no ensaio (F2) também**, contra o projeto descartável, para
descobrir o que ele mexe antes de fazer valendo.

## 5. Fases

### F0 — Decisões (bloqueia o resto)

| Item | Recomendação |
|---|---|
| Plano Supabase | **Pro, US$ 25/mês** — inclui US$ 10 de compute (cobre o Micro, mesmo tier de hoje), 8 GB de disco, 250 GB de egress, backup diário 7 dias. O Free não serve: teto de 500 MB e pausa por inatividade. |
| Região | **US West (Oregon)**, a mesma de hoje — mantém a latência para Evolution e Resend. |
| Front-end | ✅ **Decidido 22/08: fica no Lovable**, conectado ao Supabase próprio (§8). Ativa o R6 e o R7. |
| Domínio próprio para pixel/forms | ⏳ Depende do M05: decidir depois de ver quantos sites existem e se ainda recebem tráfego (R1). |
| Janela | ⏳ Campanha de 146k sem data. F1 e F2 seguem; o cutover fica em aberto. |

### F1 — Baseline e limpeza (antes de qualquer export)

1. Rodar `querys/migracao/M06` e dropar as tabelas `_bkp_*` e afins.
2. Truncar as efêmeras que não fazem falta no destino (lista em M06 §3).
3. Rodar `M01`–`M05` e guardar os CSVs — é a régua da conferência.
4. Confirmar que o banco ficou confortavelmente abaixo de 5 GB.

### F2 — Ensaio completo, sem tocar em produção

O ensaio é o que transforma o cutover em execução de roteiro. Fazer inteiro,
mesmo que pareça redundante.

1. Criar um projeto Supabase descartável.
2. Export oficial → download → restore.
3. Anotar **todo** erro do restore e a correção (ownership `supabase_admin`,
   roles com LOGIN, ordem das `auth.identities`, extensões que faltam).
4. Habilitar extensões, aplicar os fixups, recriar crons e realtime.
5. Deploy das 105 functions por CLI; conferir `verify_jwt` (31 são públicas —
   `supabase/config.toml` é a fonte).
6. Redigitar os 17 secrets.
7. Rodar M01–M05 no destino e **diferenciar contra os CSVs de F1**.
8. Testar login real com senha de um usuário existente.
9. Testar o classificador (R4) e um envio de e-mail.
10. Escrever o roteiro definitivo do cutover a partir do que doeu aqui.

### F3 — Preparar o repositório

- `supabase/config.toml` cobrindo as 105 functions (hoje tem 31 entradas).
- Script de deploy em lote e de recriação de crons parametrizado por project ref.
- `.env` novo; `src/integrations/supabase/client.ts` já lê de env, não muda.
- `supabase db dump` do destino versionado no repo — passa a ser a fonte da
  verdade do schema, encerrando o problema de 13/08.

### F4 — Cutover (janela estimada: 2–4 h)

Ordem importa. Cada passo tem um "como sei que deu certo".

| # | Passo | Verificação |
|---|---|---|
| 1 | Avisar os usuários; parar disparo de e-mail | fila `email_queue` sem `processing` |
| 2 | `UPDATE cron.job SET active = false` em todos os 40 | `select count(*) from cron.job where active` = 0 |
| 3 | Desligar o webhook das instâncias na Evolution | nada novo em `webhook_events` |
| 4 | Export oficial final | arquivo baixado, tamanho conferido |
| 5 | Restore no projeto novo | roteiro do F2, sem erro novo |
| 6 | Fixups: extensões, settings, realtime, crons reescritos | M01–M04 batem com o baseline |
| 7 | Deploy das functions + secrets | `functions list` = 105 |
| 8 | Reapontar Evolution para o novo host, por instância | mensagem de teste entra |
| 9 | Reapontar webhook do Resend, Eduzz e pagamentos | evento de teste chega |
| 10 | Trocar env do front e publicar | login real funciona |
| 11 | Reembutir pixel/forms nos sites (R1) | submissão de teste vira lead |
| 12 | Reativar crons, um grupo por vez | `job_run_details` sem `failed` |
| 13 | Observar 2 h | inbound, classificador e e-mail rodando |

### F5 — Estabilização (7 dias)

**Pausar** o Lovable Cloud, não remover. Pausado ele continua cobrando storage,
mas é o rollback. Só usar o botão Remove depois de uma semana limpa —
`Removing Lovable Cloud permanently deletes your Cloud instance and cannot be undone`.

### F6 — Descomissionar

Remover o Cloud, encerrar o custo, atualizar a documentação e fixar a regra de
governança do R6.

## 6. Rollback

Enquanto o Cloud estiver pausado, voltar é: despausar, reapontar Evolution/Resend
e o env do front. O que **não** volta são as escritas feitas no projeto novo
depois do cutover — por isso a janela é curta e os crons ficam desligados até o
fim da verificação.

## 7. Custo

| | Hoje (Lovable Cloud) | Depois (Supabase próprio) |
|---|---|---|
| Compute | Mini ≈ 9,6 créditos/ciclo | Micro coberto pelos US$ 10 do Pro |
| Total | ~23 créditos/ciclo (48% do Cloud da workspace) | **US$ 25/mês** + disco acima de 8 GB (US$ 0,125/GB) |
| Domínio próprio (opcional, R1) | — | +US$ 10/mês |

O projeto Lovable continua existindo e sendo pago à parte se o front ficar lá.

## 8. Decisão sobre o front-end — resolvida em 22/08

**O front continua no Lovable**, conectado ao Supabase próprio (Settings →
Connectors). Migra só o backend. Consequências que já estão incorporadas ao
plano:

- o projeto Lovable continua existindo e sendo pago à parte;
- `LOVABLE_API_KEY` e o gateway de IA seguem disponíveis, o que **desarma o R4**
  como bloqueio — vira só verificação no ensaio;
- em compensação, **R6 vira crítico** (o agente escreve DDL no nosso banco) e
  **R7 entra** (o ato de conectar mexe em `client.ts` e no env).

A alternativa — tirar o front do Lovable para Vercel/Netlify/Cloudflare, com o
build Vite pronto e o repo já no GitHub — fica registrada como saída futura, e
fica mais barata depois desta migração do que antes dela.

## 9. Próximo passo imediato

1. Rodar `querys/migracao/M06` → decidir o que dropar/truncar.
2. Rodar `M01`–`M05` → baseline arquivado em `querys/migracao/`.
3. Ler `M05` §4 e §5 → fecha a decisão do domínio próprio (R1).
4. Só então F2 (ensaio).

## 10. Histórico

- 2026-08-13 — migração dimensionada e **descartada** por falta de dump.
- 2026-08-22 — export oficial muda a premissa; plano refeito no método restore.
  Decidido: front fica no Lovable. Pendentes: domínio próprio (depende do M05) e
  janela do cutover (depende da campanha de 146k).
