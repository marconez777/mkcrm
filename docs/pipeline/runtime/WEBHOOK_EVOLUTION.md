---
title: "Webhook Evolution API (evolution.ts)"
topic: integration
kind: reference
audience: agent
updated: 2026-06-19
summary: "Documentação do tratamento de concorrência e race condition no webhook da Evolution API usando try-catch no erro 23505 e constraint de unique index no banco de dados."
code_refs:
  - supabase/functions/_shared/evolution.ts
  - supabase/migrations/20260619_unique_index_leads.sql
---

# Webhook Evolution API (`evolution.ts`)

O módulo `evolution.ts` atua como o ponto de entrada principal para mensagens do WhatsApp capturadas via Evolution API.

## Problema da Corrida de Webhooks (Race Condition)

No passado, múltiplos webhooks disparados simultaneamente para a mesma mensagem ou para mensagens muito próximas do mesmo contato causavam a duplicação de Leads no banco de dados. Como a ferramenta não possuía uma trava estrita a nível de banco de dados, o código Node.js tentava inserir o mesmo lead várias vezes quando o banco estava lento, causando milhares de duplicações.

## A Solução (V5)

A solução definitiva implementada em junho de 2026 consiste em duas camadas de proteção (Defesa em Profundidade):

### 1. Unique Index no Banco de Dados (PostgreSQL)

Foi criado um índice único para garantir que um mesmo telefone de uma mesma clínica nunca possa ser inserido duas vezes.

```sql
CREATE UNIQUE INDEX leads_clinic_phone_uniq
  ON public.leads (clinic_id, phone)
  WHERE phone IS NOT NULL AND phone <> '';
```

### 2. Tratamento no Código (`evolution.ts`)

O código agora implementa um fluxo de concorrência segura (Upsert manual) utilizando `try-catch` no erro específico de violação de unique constraint do Postgres (`23505`).

1. **Tentativa de Insert**: O código tenta fazer um `INSERT` direto do novo lead.
2. **Colisão (23505)**: Se outro webhook "vencer a corrida", o insert falhará com o erro `23505`. O código intercepta este erro sem quebrar a execução.
3. **Re-Select**: Após interceptar o erro `23505`, o código realiza um `SELECT` imediato buscando o lead recém-criado pelo concorrente.
4. **Continuidade**: A execução segue normalmente anexando a mensagem ao lead correto.

```typescript
// Exemplo conceitual da trava de corrida em evolution.ts
const { data: created, error } = await supabase
  .from("leads")
  .insert({ phone, name: pushName, clinic_id: clinicId })
  .select("id")
  .single();

if (error) {
  if (error.code === "23505") { // Unique violation
    // Outro webhook venceu a corrida! Re-buscando o lead...
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("phone", phone)
      .single();
    return existing;
  }
  throw error;
}
return created;
```

Com esta trava, webhooks paralelos e picos de uso nunca mais gerarão duplicações de leads, e o frontend (Kanban) permanecerá limpo.
