## Combinado

Eu executo agora tudo o que é **banco de dados** (dado, não código) e deixo o resto escrito em `docs/roadmap/roadmap-automacao.md` para você rodar no Antigravity.

---

## Parte A — O que eu faço aqui (banco de dados)

**A1. Cadastrar os 2 templates de pesquisa de satisfação**

- `ÓR — Pesquisa de Satisfação (Consulta)` → link `...1FAIpQLSeC_wBJEyM3WoNkVIf2T3UIuwd4JfbtxSNCk2sSLXoT6IvWPg`
- `ÓR — Pesquisa de Satisfação (Procedimento)` → link `...1FAIpQLSeH7jJ6Xvwk_Ceq38lHKWqeCgy4c5fNe_v7PNySUCSkd6US-g`

Texto exatamente como você mandou, só trocando a abertura por `Olá {{primeiro_nome}}! Tudo bem?` (variável que já funciona hoje). Sem nenhuma tag de data — não tem risco de sair `{{data}}` cru.

**A2. Corrigir templates com variáveis inválidas**

O renderizador só entende `{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{email}}`, `{{empresa}}` e `{{campo.<chave>}}`. Qualquer outra coisa sai **literal** para o cliente — foi isso que você viu. Vou reescrever:

| Template | Hoje (quebrado) | Vira |
|---|---|---|
| Lembrete consulta — 1 dia antes | `{{campo.data_horario}}` (chave inexistente) | `{{campo.consulta_agendada_em:data}}` às `{{campo.consulta_agendada_em:hora}}` |
| Teleconsulta (Online) | `{{data}}`, `{{horario}}` | as duas acima |
| Consulta Presencial | `{{data}}`, `{{horario}}`, `{{medico}}`, `{{endereco}}` | data/hora corretas; médico e endereço escritos fixos no texto |
| Primeira Sessão | `{{data}}`, `{{horario}}`, `{{procedimento}}` | data/hora corretas + `{{campo.procedimentos}}` |
| Lembrete — 1 hora antes | ok, não usa data | mantém |

**A3. Corrigir a condição da automação "1 Dia antes Online"**

Está gravada com `{field_key: teleconsulta, value: sim}` **sem `op`**. O código só aplica a condição quando `op` existe — ou seja, hoje o texto de teleconsulta iria também para paciente presencial. Gravo `op: eq`, e confirmo `op: neq` na presencial.

**A4. Criar as automações de 1 hora antes**

Não existe nenhuma automação com offset de 60 min — o template "1 hora antes" nunca dispara. Crio duas (presencial / online), `offset_minutes: 60`, sem `business_hours_only` (senão consulta cedo ou tarde perde o lembrete), **desligadas** até você validar.

**A5. Criar as automações de pesquisa de satisfação**

Gatilho: entrada em "Consulta finalizada". Duas regras, uma por tipo (consulta / procedimento), atraso de 2h após a mudança de coluna, uma vez por lead. Criadas **desligadas**.

**A6. Excluir as automações sobressalentes**

- `Nova automação` — vazia, sem configuração.
- `Geladeira - 7 Dias sem resposta` — duplicata de `ÓR — Move Sem Resposta → Nutrição Inativa (7d)`.
- `Limpeza Mensal - Virada de Mês` — já feita pelo cron `pipeline-monthly-cycle-or`.
- `Antigo → Nutrição Antigos (60d)` — a regra já vive no motor determinístico; manter as duas gera disputa.

**A7. Religar em ordem segura**

Ligo apenas os lembretes D-1 (presencial e online) depois de conferir o texto renderizado com um lead real. Follow-ups de IA continuam desligados até a Parte B, porque hoje eles não produzem mensagem nenhuma.

---

## Parte B — Roadmap para o Antigravity

`docs/roadmap/roadmap-automacao.md`, com arquivo, linha e o que mudar:

1. **Variáveis de agenda nativas** em `supabase/functions/_shared/template-vars.ts` + espelho `src/lib/template-vars.ts`: `{{data}}`, `{{horario}}`, `{{data_extenso}}`, `{{dia_semana}}` resolvidas a partir do agendamento do gatilho.
2. **Nunca vazar tag crua**: variável desconhecida vira string vazia + aviso no log, em vez de sair `{{data}}` para o cliente.
3. **Condição sem `op`**: em `automations-tick/index.ts` (~linha 243), assumir `eq` quando vier `field_key` sem `op`.
4. **Vazamento entre clínicas**: em `send_template` (~linha 360) a busca em `lead_custom_fields` está sem filtro de `clinic_id`.
5. **Validador de variáveis no editor de templates**: avisar ao salvar quando a variável não é reconhecida.
6. **Follow-up IA mudo**: as duas regras de follow-up da Qualificação não geram mensagem — falta agente em `action_config`.
7. **Guard do "Paciente antigo"**: `_shared/pipeline-move.ts` (~linha 186) só permite destino "Nutrição inativa", bloqueando 100% das mudas para "Nutrição Antigos".
8. **Estado atual das 6 automações que sobraram**, com o `action_config` já corrigido por mim, para o Antigravity não desfazer o trabalho.
