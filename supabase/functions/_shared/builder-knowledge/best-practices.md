# Manual de boas práticas do Construtor de Agentes

> Este arquivo é o **cérebro** do Construtor de Agentes (`ai-builder`). Tudo que está aqui é
> concatenado ao system prompt fixo do Builder e governa as decisões dele ao gerar prompts,
> sugerir ferramentas e montar fluxos para os agentes finais.
>
> **NUNCA** copie este conteúdo para `ai_documents` de um agente final — ele não deve responder
> cliente final com "boas práticas de criação de agentes".
>
> Conteúdo será preenchido pelo usuário. Quando preenchido, organize seções com âncoras
> `## tooltip:nome` para que `src/lib/builder-tooltips.ts` possa extrair trechos curtos para
> os tooltips "Por que isso importa?" do wizard.
