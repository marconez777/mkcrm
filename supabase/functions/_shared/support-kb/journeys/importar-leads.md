# Importar leads (CSV ou Kommo)

## Quando usar
Quando a clínica tem uma base existente fora do CRM e quer trazer para o Kanban.

## Pré-requisitos
- Arquivo CSV com colunas mínimas: **nome**, **telefone**. Opcionalmente: email, origem, tags, campos personalizados.
- Telefones em formato internacional (ex.: `5511999998888`) ou nacional (o sistema normaliza).

## Passo a passo (CSV)
1. Vá em **Kanban** (`/`).
2. Clique em **Importar** no topo do funil.
3. Escolha **CSV** e selecione o arquivo.
4. Mapeie as colunas do CSV para os campos do CRM (nome, telefone, etc.).
5. Escolha o **funil** e a **etapa inicial** para os leads.
6. Clique em **Importar**.

## Passo a passo (Kommo)
1. Em **Kanban**, clique em **Importar → Kommo**.
2. Cole o token de integração do Kommo.
3. Selecione o pipeline a importar.
4. Confirme.

## Como saber que deu certo
- Toast: **"X leads importados"**.
- Leads aparecem na etapa escolhida do funil.

## Se algo der errado
- "Telefone inválido" → revise o formato no CSV.
- Leads duplicados → o sistema deduplica por telefone; verifique se já existiam.
- Importação travada → ver `troubleshooting/limites-planos.md` (limite de leads do plano).

## Relacionado
- `pages/kanban.md`
