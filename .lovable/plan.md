
# Criar doc viva da reestruturação do Pipeline ÓR

## Arquivo único

**`docs/roadmap/PIPELINE_RESTRUCTURE_2026_06.md`** (frontmatter `topic: roadmap`, `kind: roadmap`, `audience: agent`, `updated: 2026-06-17`).

Serve como **fonte única de verdade** do projeto até o cutover. Marco entregue = movemos pra `docs/flows/PIPELINE_DERIVED.md` + arquivamos este.

## Estrutura do doc

```text
1. Contexto e objetivo
   - 1.625 leads, 15 colunas atuais → 9 colunas novas
   - Problemas observados no estudo (admin misturado com lead, fora de escopo
     sem coluna, risco clínico sem sinalização, etc.)

2. Decisões aprovadas
   - Orçamento de IA: até US$ 3 para reclassificação em lote
   - Administrativo = 100% B2B → vira B2B/Stakeholders, exceto fornecedor
   - "Fechamento pendente" → Qualificação
   - "Em tratamento" exige sessao_total; sem isso → Paciente antigo
   - Estratégia: pipeline-sombra dentro da Clínica ÓR (não tocar no atual
     durante o teste)

3. Mapeamento de colunas (atual → novo)
   Tabela com as 15 colunas atuais, contagem de leads, e o stage destino.

4. Novos custom_fields contratados
   Tabela: nome, tipo, enum, escrito por, lido por.
   (interesse_inicial, servicos_ativos[], tipo_contato, contato_eh_terceiro,
    responsavel, risco_clinico, is_b2b, resumo_*)

5. Novas field-rules (6) e automações (5)
   Tabela com priority, condições, target_stage.

6. Estratégia pipeline-sombra
   Diagrama ASCII (atual / durante teste / após cutover).
   Coluna leads.shadow_of_lead_id ligando cópia ↔ original.
   Por que é segura: time não percebe; rollback = DROP.

7. Plano de execução (8 fases)
   F0 verificações · F1 schema · F2 contrato · F3 shadows + IA lote
   F4 avaliação · F5 cutover atômico · F6 limpeza · F7 doc final
   Cada fase com: o que entrega, riscos, critério de aceite, owner.

8. Riscos e mitigações
   Tabela.

9. Custo de IA estimado
   ~1.300 leads × ~$0.0015 ≈ US$ 2 (gpt-5-nano).
   Halt automático se passar de US$ 2.80.

10. Checklist de cutover
    Passos manuais no dia do switch (banner UI, horário combinado,
    verificação pós-cutover, comunicação ao time).

11. Status / Diário de execução
    Seção viva atualizada a cada fase concluída, com data e link
    pro PR/migration.

12. Critérios de "entregue"
    - 0 leads no pipeline antigo
    - DRIFT.md limpo
    - docs/flows/PIPELINE_DERIVED.md atualizado
    - este arquivo movido pra docs/roadmap/_done/
```

## Side-effects desta entrega

- Atualizar `mem://index.md` adicionando referência:
  `[Pipeline restructure 2026-06](mem://docs/pipeline-restructure)` apontando pro doc.
- Atualizar `docs/roadmap/CLINIC_PIPELINE.md` com 1 parágrafo "Substituído por PIPELINE_RESTRUCTURE_2026_06.md".
- Rodar `node scripts/docs-sync.mjs` no final pra regenerar `INDEX.json` + `DRIFT.md`.

## O que NÃO faço nesta entrega

- Nenhuma migration. Nenhum código. Nenhuma edge function.
- Só o doc + atualização de índices. A execução começa quando você aprovar a Fase 0 dentro do próprio doc.

Posso criar?
