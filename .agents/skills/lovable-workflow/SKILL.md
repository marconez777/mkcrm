---
name: lovable-workflow
description: Regras para lidar com banco de dados Supabase em projetos do Lovable Cloud. Dispara ao lidar com migrações de banco, Supabase ou ao ouvir Lovable.
---

# Lovable Workflow & Supabase

Este projeto roda no ecossistema do Lovable / Lovable Cloud, que utiliza o Supabase como backend gerenciado. 
A arquitetura tem uma particularidade crítica em como lidamos com banco de dados e controle de versão:

## Regras Absolutas

1. **NUNCA tente aplicar migrações pelo terminal**. Não execute `supabase db push`, `supabase migration up`, ou `supabase db reset`. O fluxo de deploy do Lovable gerencia as instâncias na nuvem.
2. **Forneça o SQL para o usuário**. Sempre que houver necessidade de alterar o banco (criar tabelas, inserir dados de configuração como um Agente novo, atualizar registros):
    - Crie o código SQL necessário.
    - Entregue o código SQL diretamente no chat (ou em um script de rascunho) e **peça explicitamente para o usuário executá-lo no SQL Editor** do projeto.
3. **Mantenha o versionamento**. Apesar de o usuário aplicar manualmente no SQL Editor para validação em tempo real, **você DEVE criar e salvar o arquivo de migração na pasta `supabase/migrations/`**.
    - Nomeie no padrão oficial: `<timestamp>_descricao_da_mudanca.sql`.
    - Isso garante que o repositório local permaneça como a fonte da verdade.
4. **Commit Automático**. SEMPRE que você criar uma migração ou modificar arquivos neste repositório (Edge functions, frontend, configurações), **você mesmo deve executar os comandos do git** (`git add .` e `git commit -m "mensagem descritiva"`) no terminal. Não espere o usuário fazer o commit. Assuma a proatividade de versionar a sua mudança imediatamente.
