# Tags (Chips) e Campos Customizados — Clínica ÓR

Na arquitetura MKCRM, "Chips" refere-se tipicamente às `tags` renderizadas no Kanban, além dos `custom_fields` (Campos Customizados) que guardam informações valiosas como datas, intenções de interesse e status financeiros.

## Tags Automáticas de Estágio
Quando o Rule Engine move um lead de coluna (estágio), a ação aplica de forma automática e idempotente as tags relacionadas (configuradas no banco, via `pipeline_stages.auto_tag_on_enter`):

| Estágio (Stage) | Tags Aplicadas |
|---|---|
| Sem Resposta | `sem_resposta` |
| Nutrição Inativa (Geladeira de Leads) | `nutricao_inativa`, `segmento_nutricao_leads` |
| Nutrição Antigos (>60d) | `nutricao_antigos`, `segmento_nutricao_antigos` |
| Paciente Antigo | `paciente_antigo`, `segmento_paciente_antigo` |
| Consulta Finalizada | `consulta_finalizada_mes`, `segmento_relatorio_dia1` |
| 1ª Sessão Finalizada | `tratamento_finalizado_mes`, `segmento_relatorio_dia1` |

*(A trigger responsável mescla as tags sem duplicar no array de tags do lead).*

## Tags Sugeridas pela Inteligência Artificial
O Agente Tipificador (dentro do classificador V6) é responsável por ler o contexto e sugerir tags extras e comportamentais.
A aplicação dessas tags **depende estritamente de uma Whitelist** (`app_settings.automation.v42.allowed_tags`). Qualquer "alucinação" da IA que invente tags bizarras é silenciosamente descartada no filtro final do script `apply.ts`.

Exemplos de tags operadas em runtime e inteligência:
- `urgencia_clinica`: Extraído pela intenção de urgência. Sinaliza a necessidade iminente de intervenção.
- `precisa_atencao_humana`: Emitida por falha de confiança no LLM, por Agentes Auditores (A1, A2) alertando discordância, ou quando um movimento escapa das regras mapeadas.
- `b2b_auto`: Anexada quando a IA descobre que a conversa é de perfil B2B e move automaticamente.
- `agendamento_sugerido`: Substitui a tentativa falha da IA de tentar marcar consultas. Apenas sugere e agenda uma tarefa.

## Campos Customizados
Ao lado das tags, a IA atualiza campos via um formato de patch JSON (`custom_fields_patch`).

- **Bloqueio de Agendamentos da IA (Gate G11):** Os campos de datas de consulta (`consulta_agendada_em`, `procedimento_agendado_em`) foram removidos do escopo de preenchimento autônomo. 
- **Campos Típicos Sugeridos:** `interesse_consulta`, `interesse_tratamento`, `nome_responsavel_financeiro`, `possui_liminar_judicial`.
- **Precedência (Gate G10):** Se a secretária editar qualquer campo customizado, a IA fica proibida de alterar o exato mesmo campo (a mesma chave JSON) pelos próximos 7 dias. Isto é gerenciado via trigger no DB que anota a data da edição humana em `custom_fields_last_human_edit`.
