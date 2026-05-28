## Diagnóstico

O relatório da automação "Teste PHQ9" mostra 0 enviados / 0 cliques porque ele filtra `email_logs` por `related_lead_table = 'automation_<id-atual>'`, mas:

1. **Os e-mails de teste foram enviados sob um ID antigo.** O lead `alinehhvv@gmail.com` (delivered) e `marco_next7@hotmail.com` (clicked) têm logs com `related_lead_table = 'automation_f844b5b5-b337-4321-bb9b-5c232e260d2d'` — uma versão anterior desta automação que foi recriada. A automação atual é `d45d9c35-...`, então o relatório ignora esses 2 logs.
2. **A automação atual ainda não disparou nada.** As 2 enrollments atuais (`v.juliane26@gmail.com`, `lemos.venite@gmail.com`) têm os primeiros envios agendados para `2026-05-29` (`email_queue.status = pending`). Por isso "Na fila = 2" e "Enviados = 0".
3. O clique que você viu no Resend é do `marco_next7@hotmail.com` — esse lead está no log órfão (ID antigo).

## Plano de correção

Mudar o relatório para correlacionar logs por **lead + template_slug** (em vez de só pelo `related_lead_table`), assim ele captura logs de versões antigas da mesma automação.

### Mudanças

**`src/components/email/AutomationReportDialog.tsx`**
- Buscar `lead_id`s do `email_automation_enrollments` da automação atual (já temos a contagem; agora vamos pegar os IDs).
- Carregar `email_logs` por `related_lead_id IN (enrolled_lead_ids) AND template_slug IN (steps_slugs) AND clinic_id = <clinic>`, em vez de filtrar por `related_lead_table`. Isso é resiliente a:
  - automação recriada (ID muda)
  - prefixos antigos (`auto_...` truncado vs `automation_...`)
- Manter o filtro de `email_queue` por `related_lead_table = 'automation_<id>'` (a fila atual já está correta), mas adicionar fallback para `related_lead_id IN (enrolled_lead_ids) AND template_slug IN (steps_slugs)` para cobrir filas geradas com prefixos antigos.
- Sem mudanças visuais; só a fonte dos números fica correta.

### Backfill opcional (uma vez)

Os 2 logs órfãos da Aline e do Marco continuam apontando pro ID antigo. Posso rodar:
```sql
UPDATE email_logs
SET related_lead_table = 'automation_d45d9c35-911a-4c89-96dd-571314472783'
WHERE related_lead_table = 'automation_f844b5b5-b337-4321-bb9b-5c232e260d2d';
```
Mas com a mudança acima, isso deixa de ser necessário — o relatório passa a casar via `lead_id + template_slug`. Posso pular o backfill se preferir.

### Não muda

- `email-automations-tick`, `process-email-queue`, schema de tabelas.
- A UI/visual do relatório.
