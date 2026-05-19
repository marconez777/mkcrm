# Plano de correção do Tracking

## O que está acontecendo
A tela de `/tracking` está com pelo menos 2 problemas diferentes:

1. **Bug crítico no vínculo visitante → lead na própria consulta da tela**
   - A aba usa `tracking_identity_links.source_event` no select.
   - No banco, a coluna real é **`link_source`**.
   - A requisição atual está falhando com erro 400: `column tracking_identity_links.source_event does not exist`.
   - Quando essa consulta falha, o mapa `links` fica vazio e por isso somem:
     - coluna **Lead**
     - coluna **Etapa**
     - badge de **WhatsApp** no lead
     - contagem de “Viraram lead”
     - aba “Leads com origem”

2. **A flag de WhatsApp da aba Visitantes depende demais do filtro global de eventos**
   - Hoje os flags `WA / Form / Submit` são calculados só com base em `events` já filtrados por período e filtros globais.
   - Se houver filtro ativo em `event_name`, `page_url`, `lead_id` etc., a linha do visitante pode continuar aparecendo, mas o flag `WA` pode ficar falso mesmo existindo evento `whatsapp_redirect` na jornada completa.
   - Isso explica a sensação de “sumiu tudo” ou “não mostra mais clique”, principalmente em testes e revisões rápidas.

## O que vou corrigir

### 1. Corrigir a leitura do vínculo visitante → lead
Em `src/pages/Tracking.tsx`:
- trocar o select de `tracking_identity_links` para usar os campos reais do banco:
  - `link_source`
  - `linked_at`
  - manter `created_at` só se for útil para ordenação/auditoria
- alinhar o tipo `LinkRow` com o schema real
- atualizar todo uso de `source_event` para `link_source`
- usar `linked_at` como referência temporal da conversão quando fizer sentido

### 2. Restaurar os dados que dependem desse vínculo
Com o item acima corrigido, a tela volta a popular corretamente:
- **Lead** na aba Visitantes
- **Etapa** do funil
- badge **WhatsApp** quando `link_source` vier de origem WhatsApp
- contagem **Viraram lead** na aba WhatsApp
- listagem **Leads com origem**

### 3. Tornar a flag de WhatsApp mais confiável na aba Visitantes
Vou separar melhor o cálculo para que a coluna `WA` não desapareça por causa de um detalhe do filtro:
- considerar `whatsapp_click` e `whatsapp_redirect`
- se necessário, também inferir origem WhatsApp a partir do próprio vínculo (`link_source` começando com `whatsapp_` ou `ctwa_clid`) quando a consulta de eventos filtrada não trouxer tudo
- revisar o comportamento para não depender apenas do subconjunto de eventos filtrado

### 4. Revisão profunda da lógica da página inteira
Vou revisar os pontos que hoje podem gerar inconsistência visual:
- resumo dos cards
- aba Visitantes
- aba Leads com origem
- aba WhatsApp
- modal Jornada
- consistência entre nomes reais do banco e nomes usados na UI

## Validação esperada depois da correção
No seu caso de teste com o visitor `v_b8b6efe15bf84172ad2fd049`:
- a aba **Visitantes** deve voltar a mostrar:
  - **WA = sim**
  - **Lead = Ana Paula MK ART** (ou o lead correspondente)
  - **Etapa** do funil
- a aba **Leads com origem** deve listar esse vínculo
- a aba **WhatsApp** deve contar esse visitante em **Viraram lead**
- o modal da jornada deve continuar mostrando `whatsapp_redirect` + `lead_identified`

## Detalhes técnicos
- Arquivo principal: `src/pages/Tracking.tsx`
- Sem mudança de schema do banco nesta etapa
- O principal erro atual é de integração entre frontend e schema já existente, não da identificação em si
- Evidência confirmada: a requisição atual da tela para `tracking_identity_links` está retornando 400 por causa de coluna inexistente (`source_event`)

Se aprovar, eu implemento a correção direto na tela e valido no preview.