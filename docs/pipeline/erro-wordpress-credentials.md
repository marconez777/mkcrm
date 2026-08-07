# Documentação de Erro: WordPress credentials not configured

Esta documentação foi gerada para analisar e explicar o erro de Pipeline HTTP 500 relatado na interface do MKCRM (Pipeline Runs).

## 1. O Erro Encontrado
**Mensagem de erro:**
`Pipeline HTTP 500: {"success":false,"error":"HTTP 500: {\"success\":false,\"error\":\"WordPress credentials not configured for this site\"}"}`

**Contexto visual:** 
O erro ocorre na tela "Processar Fila" (`Kanban.tsx` / `PipelineRuns.tsx`), no meio da execução do pipeline, especificamente em uma etapa nomeada como **"Etapa 4/6: Gerando SEO..."**.

## 2. Onde esse erro está ocorrendo no código?

Este erro **não é gerado internamente** pelo código do MKCRM (TypeScript/Supabase). Ele é o repasse de uma resposta de uma API externa (por isso o formato `{"success":false,"error":...}`).

A arquitetura de como o erro chega à interface é a seguinte:

1. **Frontend (`src/pages/PipelineRuns.tsx`):** Lê e exibe o JSON de erro salvo na tabela `pipeline_run_items`.
2. **Backend / Executor (`supabase/functions/pipeline-run-executor/index.ts`):** O executor roda os leads em chunks e orquestra as chamadas para a função responsável por rodar os agentes.
3. **Agente / Classificador (`supabase/functions/pipeline-classify/`):** Durante a Etapa 4 ("Gerando SEO"), o agente (LLM ou função paralela) tenta disparar uma requisição HTTP externa (webhook) para publicar ou gerar o conteúdo SEO diretamente no site WordPress do lead ou tenant.
4. **Sistema Destino (WordPress ou Webhook intermediário como n8n/Make):** Ao receber a requisição sem autenticação válida, o servidor destino retorna o erro `HTTP 500` com a mensagem `"WordPress credentials not configured for this site"`. A Edge Function recebe isso, falha, e salva o erro na tabela.

## 3. Qual é a causa raiz?

A causa raiz é uma falha de configuração e integração. A funcionalidade de "Gerando SEO" (ligada possivelmente à skill de "Setup Blog PBN" ou a integrações de conteúdo de SEO automatizado do Lovable Cloud) exige que o MKCRM tenha as credenciais de acesso ao WordPress.

O sistema remoto recusou a conexão porque o MKCRM (ou o webhook intermediário) não enviou as credenciais corretas (ex: *Application Passwords* do WordPress REST API, JWT, ou chaves de API).

## 4. Como Corrigir / Próximos Passos

Para resolver o erro, você deve:

1. **Identificar o Site/Tenant:** Veja qual clínica ou URL alvo está sendo processada nesse item que falhou.
2. **Configurar as Credenciais no WordPress:**
   * Acesse o painel do WordPress em questão (`/wp-admin`).
   * Vá em **Usuários -> Perfil** e gere uma **Senha de Aplicativo** (Application Password) para a REST API.
3. **Salvar no MKCRM:**
   * Dependendo de como o webhook está configurado, essas credenciais devem ser salvas no painel de configurações do MKCRM (ex: Variáveis de Ambiente, `app_settings`, configurações da Clínica/Tenant) ou diretamente na plataforma de automação (Make.com/n8n) caso a etapa 4 faça proxy por lá.
4. **Reprocessar Erros:** Após configurar as credenciais, utilize o botão **"Reprocessar Erros"** na interface do `PipelineRuns.tsx` para tentar novamente a publicação.
