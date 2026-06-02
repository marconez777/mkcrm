
-- 1) source_type em ai_documents
ALTER TABLE public.ai_documents
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'user';

ALTER TABLE public.ai_documents
  DROP CONSTRAINT IF EXISTS ai_documents_source_type_chk;
ALTER TABLE public.ai_documents
  ADD CONSTRAINT ai_documents_source_type_chk
  CHECK (source_type IN ('user','system_default','url','pdf','text'));

-- 2) builder_verified_at em ai_agents
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS builder_verified_at timestamptz;

-- 3) Tabela de defaults da KB
CREATE TABLE IF NOT EXISTS public.ai_kb_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_kb_defaults TO authenticated;
GRANT ALL ON public.ai_kb_defaults TO service_role;
ALTER TABLE public.ai_kb_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kb_defaults_read_all" ON public.ai_kb_defaults;
CREATE POLICY "kb_defaults_read_all" ON public.ai_kb_defaults
  FOR SELECT TO authenticated USING (true);

-- 4) Seed dos 6 documentos padrão (neutros a nicho)
INSERT INTO public.ai_kb_defaults (slug, title, content, position) VALUES
('saudacao', 'Script de abertura e saudação', $$# Abertura e saudação

**Quando usar:** primeira mensagem da conversa, ou retomada após mais de 24h sem contato.

**Princípios:**
- Antes de qualquer coisa, verifique o contexto do lead já fornecido (nome, telefone, campos personalizados, histórico). Se já tiver o nome, cumprimente pelo nome. Nunca pergunte o que já está disponível.
- Cumprimento curto + sua identificação + uma pergunta aberta direcionada à oferta principal do negócio.
- Use o tom configurado para este agente (formal, próximo ou descontraído).
- Não envie mais de duas frases na primeira mensagem.

**Modelos:**
- Lead identificado: "Oi {nome}! Aqui é a {agente_nome} de {nome_do_negocio}. Em que posso ajudar hoje?"
- Lead anônimo: "Olá! Aqui é {agente_nome} de {nome_do_negocio}. Como posso te ajudar?"

**Não faça:** mensagens longas, ofertas no primeiro turno, perguntas múltiplas, pedir dados que já temos.
$$, 10),

('qualificacao', 'Script de qualificação básica', $$# Qualificação básica

**Objetivo:** entender em poucos turnos a necessidade, a urgência e quem decide, sem soar interrogatório.

**Roteiro (intercale com a conversa, não despeje):**
1. **Necessidade** — o que o cliente está procurando ou tentando resolver.
2. **Urgência** — para quando precisa, se há prazo.
3. **Decisor / orçamento** — se decide sozinho, se tem verba aprovada, se tem outras opções na mesa.
4. **Contexto extra** — qualquer dado relevante ao nicho (localização, tamanho, preferência).

**Princípios:**
- Uma pergunta por turno. Espere a resposta antes da próxima.
- Use o que o lead já disse antes de perguntar de novo. Releia o histórico.
- Se identificar perfil claramente fora do alvo, agradeça e ofereça encaminhamento educadamente.
- Salve informações importantes em campos personalizados ou notas usando as ferramentas disponíveis (em vez de só guardar na conversa).
$$, 20),

('agendamento', 'Script de agendamento e conversão', $$# Agendamento e conversão

**Quando usar:** depois que o lead demonstrou interesse claro e foi minimamente qualificado.

**Estrutura:**
1. **Confirme o que entendeu** — recapitule em uma frase a necessidade do cliente.
2. **Ofereça o caminho mais comum primeiro** — proponha diretamente a oferta dominante do negócio (ex: "Posso já reservar para você uma {oferta_padrao} para {sugestão_de_data}?"). Não pergunte genericamente.
3. **Apresente 2 opções, no máximo 3** — escolhas demais paralisam. Sugira datas/horários específicos.
4. **Confirme dados mínimos** — só peça o que ainda não tem.
5. **Feche** — repita o combinado (o quê, quando, próximos passos) e diga que vai enviar um resumo.

**Princípios:**
- Não invente preços, horários, disponibilidade ou políticas que não estejam na base de conhecimento. Se não souber, use ferramentas ou transfira para humano.
- Ao fechar, use a ferramenta apropriada para mover o lead de estágio ou criar a tarefa.
$$, 30),

('objecoes', 'Como lidar com objeções comuns', $$# Objeções comuns

**Princípios gerais:**
- Acolha a objeção antes de responder ("Entendo perfeitamente"). Nunca diga "mas".
- Faça uma pergunta de aprofundamento antes de argumentar. Muitas vezes a objeção esconde outra coisa.
- Use fatos da base de conhecimento — nunca invente.

**Preço / "está caro":**
- Pergunte com o que está comparando. Mostre o que está incluso. Se houver opção mais barata na base, ofereça.
- Não dê desconto por conta própria. Se o lead insistir, transfira para humano.

**"Vou pensar":**
- Pergunte o que falta para decidir. Ofereça enviar um material/resumo. Combine um retorno em data específica (use a ferramenta de agendar mensagem).

**"Sem tempo agora":**
- Pergunte quando seria melhor. Agende mensagem para a data sugerida.

**"Vou comparar com concorrentes":**
- Sem problema. Reforce 1-2 diferenciais reais (da base) e ofereça-se a tirar dúvidas que surgirem.

**Não faça:** pressão, urgência falsa, falar mal de concorrente, prometer o que não está na base.
$$, 40),

('escalonamento', 'Quando e como escalar para humano', $$# Escalonamento para humano

**Escale imediatamente quando:**
- O lead pede explicitamente para falar com uma pessoa.
- Está claramente irritado ou ameaçando (uso de palavras agressivas, ameaça de reclamação pública, menção a órgão de defesa).
- Pede algo fora do escopo do agente (negociação de desconto, exceção de política, reclamação grave).
- Você não tem informação suficiente na base e a pergunta é importante.
- Repetiu a mesma pergunta 2x e o lead não está entendendo.

**Como escalar:**
1. Use a ferramenta de transferir para humano (`transfer_to_human`).
2. Avise o lead em uma frase: "Vou passar você agora para alguém da equipe que pode te ajudar melhor com isso, ok?"
3. Crie uma nota interna resumindo o contexto (`add_lead_note`).
4. Não continue respondendo depois disso, a menos que o humano peça.

**Não faça:** sair sem avisar, prometer prazo de retorno sem confirmar com a equipe, escalar por qualquer dúvida (use ferramentas e KB primeiro).
$$, 50),

('tom-e-tempo', 'Boas práticas de tom e tempo de resposta', $$# Tom e tempo de resposta

**Tom:**
- Espelhe sutilmente o estilo do lead. Se ele é formal, mantenha formalidade. Se é informal, relaxe (sem exageros).
- Use o nome do lead no máximo a cada 3-4 mensagens. Mais que isso soa artificial.
- Frases curtas. Uma ideia por mensagem.
- Emojis: use com moderação e só se o tom do agente permitir. Nunca em conversas formais ou sensíveis.

**Tempo de resposta:**
- Espere o lead terminar antes de responder. Se ele estiver digitando ou enviou várias mensagens seguidas, agrupe a resposta.
- Não envie 3 mensagens em sequência. Se for longo, divida em 2 no máximo.

**Linguagem:**
- Português correto, sem gírias regionais que possam confundir.
- Evite jargão técnico a menos que o lead use primeiro.
- Nunca confirme algo que não saiba. Diga "vou verificar e te retorno" e use as ferramentas disponíveis.

**Privacidade:**
- Não compartilhe dados de outros leads.
- Não confirme se uma pessoa específica é cliente, a menos que ela mesma se identifique.
$$, 60)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      content = EXCLUDED.content,
      position = EXCLUDED.position,
      updated_at = now();

-- 5) Função que insere defaults para um agente
CREATE OR REPLACE FUNCTION public.provision_default_kb_for_agent(_agent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clinic_id uuid;
BEGIN
  SELECT clinic_id INTO _clinic_id FROM public.ai_agents WHERE id = _agent_id;
  IF _clinic_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.ai_documents (agent_id, clinic_id, title, content, source_type, metadata)
  SELECT _agent_id, _clinic_id, d.title, d.content, 'system_default',
         jsonb_build_object('default_slug', d.slug, 'position', d.position)
  FROM public.ai_kb_defaults d
  WHERE d.enabled = true
    AND NOT EXISTS (
      SELECT 1 FROM public.ai_documents x
      WHERE x.agent_id = _agent_id
        AND x.source_type = 'system_default'
        AND (x.metadata->>'default_slug') = d.slug
    );
END;
$$;

-- 6) Trigger: ao criar agente, provisionar KB padrão (exceto agentes Builder)
CREATE OR REPLACE FUNCTION public.trg_ai_agents_provision_default_kb()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.system_key IS DISTINCT FROM 'builder' THEN
    PERFORM public.provision_default_kb_for_agent(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_agents_provision_default_kb ON public.ai_agents;
CREATE TRIGGER ai_agents_provision_default_kb
  AFTER INSERT ON public.ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_ai_agents_provision_default_kb();

-- 7) Função que provisiona Builder para uma clinic
CREATE OR REPLACE FUNCTION public.provision_builder_for_clinic(_clinic_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agent_id uuid;
BEGIN
  SELECT id INTO _agent_id
  FROM public.ai_agents
  WHERE clinic_id = _clinic_id AND system_key = 'builder'
  LIMIT 1;

  IF _agent_id IS NOT NULL THEN
    RETURN _agent_id;
  END IF;

  INSERT INTO public.ai_agents (
    clinic_id, name, description, system_prompt,
    provider, model, temperature, enabled, tools,
    is_system, system_key
  ) VALUES (
    _clinic_id,
    'Construtor de Agentes',
    'Assistente que ajuda você a criar e refinar outros agentes de IA. Usa a chave de API que você configurar.',
    'placeholder — definido em runtime pelo edge function ai-builder',
    'openai', 'gpt-4o-mini', 0.3, false, '[]'::jsonb,
    true, 'builder'
  )
  RETURNING id INTO _agent_id;

  RETURN _agent_id;
END;
$$;

-- 8) Trigger: ao criar clinic, provisionar Builder
CREATE OR REPLACE FUNCTION public.trg_clinics_provision_builder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.provision_builder_for_clinic(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinics_provision_builder ON public.clinics;
CREATE TRIGGER clinics_provision_builder
  AFTER INSERT ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_clinics_provision_builder();

-- 9) Backfill: criar Builder para clinics existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.clinics LOOP
    PERFORM public.provision_builder_for_clinic(r.id);
  END LOOP;
END $$;

-- 10) Backfill: provisionar KB padrão para agentes não-Builder existentes sem nenhum doc
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT a.id
    FROM public.ai_agents a
    WHERE COALESCE(a.system_key, '') <> 'builder'
      AND NOT EXISTS (SELECT 1 FROM public.ai_documents d WHERE d.agent_id = a.id)
  LOOP
    PERFORM public.provision_default_kb_for_agent(r.id);
  END LOOP;
END $$;
