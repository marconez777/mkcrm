# Modelos e Agentes do Pipeline V6

O Pipeline V6 abandona o modelo de agente monolítico ou sequencial de 3 estágios, adotando uma "Linha de Montagem de 5 Agentes" (`Resumidor → [Agendador ∥ Tipificador ∥ Movimentador] → Maestro`).

## Provedor e Modelos
O provedor principal para os modelos é a **Lovable** (utilizando modelos da série Gemini 2.5), em função do seu alto desempenho para o volume de dados da clínica e rate limits flexíveis. Em caso de indisponibilidade, quota esgotada, ou se especificado por configuração (`CLASSIFIER_PROVIDER=openai`), a V6 opera com fallback automático para a **OpenAI** (série GPT).

A configuração estrita dos modelos é mapeada no `agent-core.ts`. Abaixo estão os modelos especificados para cada agente dependendo do provedor (Primário Lovable vs Fallback OpenAI).

| Agente | Provedor Principal (Lovable) | Provedor de Fallback (OpenAI BYOK) | Tarefa Principal |
|---|---|---|---|
| **Resumidor** | `google/gemini-2.5-flash` | `gpt-4o` | Resume o histórico do paciente focando em fatos e datas determinísticas. |
| **Resumidor (Fallback)** | `google/gemini-2.5-flash-lite`| `gpt-5-mini` | Fallback imediato do Resumidor caso o modelo titular falhe (timeout ou formato). |
| **Agendador** | `google/gemini-2.5-flash-lite`| `gpt-5-nano` | Identifica sinais de intenção de agendamento na resposta. |
| **Tipificador** | `google/gemini-2.5-flash` | `gpt-5-mini` | Preenche chaves dos Custom Fields e aplica Tags do dicionário. |
| **Movimentador** | `google/gemini-2.5-flash-lite`| `gpt-5-nano` | Processa as intenções não-agendamento e sugere mudanças de stage do Kanban. |
| **Maestro** | `google/gemini-2.5-flash` | `gpt-5` | (Agente Juiz) Recebe as deduções paralelas e o resumo para decidir a movimentação definitiva. |

**Performance e Custos:** A utilização dos modelos "lite" e "nano" para o Agendador e Movimentador permite respostas rápidas a esquemas simples, diminuindo substancialmente os custos e a latência durante a fase paralela. O `Maestro` sempre utilizará modelos mais densos para evitar alucinações na escolha de fluxos críticos como B2B ou reagendamento sem aviso.

## Regras e Modos de Falha
As regras de telemetria preveem logs independentes por agente, o que ajuda na detecção de modelos "rebeldes". Se o `Resumidor` falhar, toda a execução é abortada. Se o processo paralelo `[Agendador ∥ Tipificador ∥ Movimentador]` sofrer falhas de esquema em qualquer agente (mesmo após os retries automáticos com compactação JSON), a execução paralela também é abortada antes de atingir o `Maestro`.
