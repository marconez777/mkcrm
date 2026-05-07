## Plano: consolidar funis em "Agendamentos Novo"

### Situação atual
- **Agendamentos Novo** (`737242e7…`) — kind=`internal`, 907 leads (alimentado pelas secretárias). Será o oficial.
- **Vendas** (`b19849c5…`) — kind=`sales`, padrão ⭐, 22 leads, sem instância.
- **Vendas** (`3d05c61e…`) — kind=`sales`, 21 leads, vinculado à instância **Recepção** (recebendo agora).
- Instância WhatsApp: apenas **Recepção** cadastrada.

### Passos (operação no banco)

1. **Desvincular Recepção** do funil `3d05c61e…` (libera a instância).
2. **Converter "Agendamentos Novo" para sales** (`kind='sales'`) e **vincular Recepção** a ele. Marcar como **padrão** (⭐) e desmarcar o atual.
3. **Mover leads dos dois "Vendas" → "Agendamentos Novo"**:
   - Mapear etapas por nome (case-insensitive). Quando não houver correspondência, jogar na 1ª etapa (menor `position`) do destino.
   - Total movido: 43 leads (22 + 21).
4. **Excluir os dois funis "Vendas"** (já vazios). Como `pipeline_stages` provavelmente não tem CASCADE, removo as etapas órfãs antes.
5. **Confirmação final via SELECT**: listar funis e contagens para garantir que só "Agendamentos Novo" tem instância vinculada e ninguém mais recebe WhatsApp.

### Resultado esperado
- Apenas **"Agendamentos Novo"** recebe leads do WhatsApp (via Recepção).
- Todos os leads das duas "Vendas" preservados dentro de "Agendamentos Novo", nas etapas equivalentes ou na 1ª etapa.
- Para cadastrar mais números no futuro: Configurações → cadastrar nova instância WhatsApp → abrir o funil desejado → "Editar funil" → selecionar a instância no campo "Número de WhatsApp". Já funciona, sem código novo.

### Melhoria pequena de UX (opcional, me confirma)
Em `src/components/kanban/EditPipelineDialog.tsx`, no campo "Número de WhatsApp", mostrar ao lado de cada instância já usada o nome do funil que a está usando (em vez de simplesmente esconder), para o usuário entender por que ela "sumiu" da lista. Sem mudança de comportamento, só clareza.

### Observação importante
Vou executar as operações de banco direto (UPDATE/DELETE), não vai precisar reload manual — só atualizar a página depois.