
-- 1) Niche columns on ai_agents
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS niche text,
  ADD COLUMN IF NOT EXISTS niche_other text;

-- 2) Niche column on ai_kb_defaults (NULL = generic, applies to all)
ALTER TABLE public.ai_kb_defaults
  ADD COLUMN IF NOT EXISTS niche text;

-- Replace unique(slug) with unique(slug, niche)
ALTER TABLE public.ai_kb_defaults
  DROP CONSTRAINT IF EXISTS ai_kb_defaults_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS ai_kb_defaults_slug_niche_uidx
  ON public.ai_kb_defaults (slug, COALESCE(niche, '_generic'));

-- 3) Provisioning function: generic + niche-specific
CREATE OR REPLACE FUNCTION public.provision_default_kb_for_agent(_agent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clinic_id uuid;
  _niche text;
BEGIN
  SELECT clinic_id, niche INTO _clinic_id, _niche
  FROM public.ai_agents WHERE id = _agent_id;
  IF _clinic_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.ai_documents (agent_id, clinic_id, title, content, source_type, metadata)
  SELECT _agent_id, _clinic_id, d.title, d.content, 'system_default',
         jsonb_build_object(
           'default_slug', d.slug,
           'position', d.position,
           'niche', d.niche
         )
  FROM public.ai_kb_defaults d
  WHERE d.enabled = true
    AND (d.niche IS NULL OR d.niche = _niche)
    AND NOT EXISTS (
      SELECT 1 FROM public.ai_documents x
      WHERE x.agent_id = _agent_id
        AND x.source_type = 'system_default'
        AND (x.metadata->>'default_slug') = d.slug
        AND COALESCE(x.metadata->>'niche', '') = COALESCE(d.niche, '')
    );
END;
$$;

-- 4) RPC to re-provision after niche change (callable from UI)
CREATE OR REPLACE FUNCTION public.reprovision_default_kb_for_agent(_agent_id uuid)
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
  -- caller must belong to clinic
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = _clinic_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  PERFORM public.provision_default_kb_for_agent(_agent_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reprovision_default_kb_for_agent(uuid) TO authenticated;

-- 5) Seed niche-specific defaults
INSERT INTO public.ai_kb_defaults (slug, title, content, position, niche) VALUES

-- ============ CLINIC ============
('clinic_agendamento', 'Agendamento de consulta (clínica)', $$# Agendamento de consulta — clínica

**Oferta dominante:** consulta com o profissional/especialidade principal da clínica.

**Roteiro:**
1. Confirme rapidamente a queixa ou objetivo do paciente em uma frase.
2. Ofereça já o profissional principal: "Posso agendar uma avaliação com {Dr./Dra. principal} para {sugestão de data}?"
3. Apresente no máximo 2-3 horários disponíveis.
4. Confirme nome completo e telefone se ainda não estiverem no contexto.
5. Use a ferramenta de agendamento para criar o compromisso e mover o lead de estágio.
6. Envie um resumo: profissional, data, horário, endereço/link, instruções de preparo se houver.

**Atenção:**
- Nunca prometa diagnóstico, prognóstico ou tratamento — só agende a avaliação.
- Se for urgência clínica (dor forte, sintoma agudo, gestante com sangramento, criança com febre alta), transfira para humano imediatamente.
$$, 50, 'clinic'),

('clinic_qualificacao', 'Triagem de paciente (clínica)', $$# Triagem básica de paciente

**Objetivo:** entender o motivo do contato sem fazer diagnóstico.

**Pergunte com cuidado, uma de cada vez:**
1. Qual é a queixa principal ou o motivo de procurar atendimento?
2. Há quanto tempo está com isso?
3. É a primeira vez na clínica ou já é paciente?
4. Convênio ou particular? (se a clínica atende ambos)

**Princípios:**
- Não diga "é provavelmente X" nem sugira tratamento. Diga "o profissional vai avaliar".
- Se mencionar sintoma grave (dor torácica, falta de ar, sangramento, perda de consciência, pensamento de se machucar), interrompa a triagem e oriente buscar pronto-socorro / SAMU 192. Em seguida, transfira para humano.
- Salve a queixa em campo personalizado ou nota para o profissional ver antes da consulta.
$$, 60, 'clinic'),

('clinic_objecoes', 'Objeções comuns em clínicas', $$# Objeções específicas de clínicas

**"Não sei se preciso de consulta":**
- Acolha. Pergunte os sintomas. Reforce que a avaliação é justamente para esclarecer e não compromete tratamento.

**"Está caro / não cabe no orçamento":**
- Pergunte se prefere particular ou se quer verificar convênio. Mencione formas de pagamento da base de conhecimento. Não dê desconto por conta própria.

**"Vou esperar passar":**
- Não pressione. Diga que se persistir vale avaliar. Ofereça agendar mensagem de follow-up em 5-7 dias.

**"Tenho medo de ir ao médico/dentista":**
- Acolha de verdade. Mencione (se for verdade na base) que a clínica tem abordagem acolhedora, sedação consciente, primeira consulta sem procedimento, etc.
$$, 70, 'clinic'),

-- ============ DENTAL ============
('dental_agendamento', 'Agendamento odontológico', $$# Agendamento — odontologia

**Oferta dominante:** avaliação com a especialidade principal da clínica (ex: clínica geral, ortodontia, implantes, estética).

**Roteiro:**
1. Identifique se é primeira consulta, retorno ou emergência.
2. Para nova avaliação: ofereça já o horário com o especialista principal.
3. Para emergência (dor forte, trauma, abscesso): priorize encaixe no mesmo dia ou próximo dia útil; se fora do horário, oriente analgesia caseira segura e contato urgente.
4. Confirme nome, telefone e convênio (se aplicável).
5. Combine envio de orientações pré-consulta (jejum não costuma ser necessário; trazer exames anteriores se houver).
$$, 50, 'dental'),

('dental_qualificacao', 'Triagem odontológica', $$# Triagem odontológica

**Pergunte:**
1. O que está acontecendo? (dor, sensibilidade, estética, prevenção, retorno)
2. Há quanto tempo?
3. Já é paciente da clínica ou primeira vez?
4. Convênio odontológico ou particular?

**Sinais para encaminhar como emergência:**
- Dor forte que não passa com analgésico comum
- Inchaço no rosto ou gengiva com pus
- Trauma (queda, batida) com dente quebrado ou deslocado
- Sangramento que não cessa

Nestes casos, abra encaixe no mesmo dia e/ou transfira para humano.
$$, 60, 'dental'),

('dental_objecoes_estetica', 'Objeções estéticas e financeiras (odonto)', $$# Objeções comuns — odontologia

**"Quanto custa o clareamento / lente / implante?":**
- Não invente valor. Diga que depende da avaliação (quantos dentes, condição da gengiva, etc.) e ofereça agendar a avaliação que normalmente é mais barata ou gratuita (confirme na base).

**"Tenho medo de dentista":**
- Acolha sem minimizar. Mencione (se for verdade) abordagem acolhedora, sedação, anestesia indolor, primeira consulta só de conversa.

**"Vou pensar no orçamento":**
- Pergunte se quer receber o orçamento por escrito. Combine retomada em 3-5 dias via mensagem agendada.

**"Convênio cobre?":**
- Confirme na base quais convênios e quais procedimentos. Se não souber, não invente — escale.
$$, 70, 'dental'),

-- ============ REAL ESTATE ============
('realestate_agendamento', 'Agendamento de visita (imóvel)', $$# Agendamento de visita

**Oferta dominante:** agendar visita ao imóvel certo (locação ou venda) na região de interesse.

**Roteiro:**
1. Confirme o que está procurando: locação ou venda, tipo (apto, casa, sala), número de quartos, bairro(s).
2. Confirme orçamento aproximado (aluguel mensal ou valor de compra).
3. Filtre 1-3 imóveis da base que batem. Envie fotos/link se a base tiver media.
4. Ofereça 2 horários de visita.
5. Confirme nome, telefone e se vai com mais alguém (decisor presente).
6. Combine encontro: endereço, ponto de referência, contato do corretor responsável.

**Não faça:** prometer negociação de valor, garantir financiamento, falar de imóveis fora da base.
$$, 50, 'real_estate'),

('realestate_qualificacao', 'Qualificação de comprador/inquilino', $$# Qualificação imobiliária

**Pergunte (uma por turno, mistura com conversa):**
1. Locação ou compra?
2. Quantos quartos / vagas / tamanho aproximado?
3. Bairros de interesse?
4. Faixa de valor confortável?
5. Para quando precisa (urgência: já, 30 dias, 3 meses+)?
6. Tem pré-aprovação de financiamento? (se compra) / Pode comprovar renda 3x? (se aluguel)

**Use os dados:**
- Salve preferências em campos personalizados (bairro, faixa, urgência) para futuras ofertas.
- Se o perfil não bater com nenhum imóvel da base, seja honesto, agradeça e marque o lead para receber novidades.
$$, 60, 'real_estate'),

('realestate_objecoes', 'Objeções imobiliárias', $$# Objeções comuns — imobiliária

**"Está acima do meu orçamento":**
- Pergunte qual o teto. Filtre imóveis dentro do orçamento. Se nada bate, ofereça aviso quando entrar opção.

**"Quero negociar o valor":**
- Não prometa desconto. Diga que pode encaminhar a proposta ao proprietário/corretor responsável após a visita.

**"E a documentação / financiamento?":**
- Liste documentação básica da base (RG, CPF, comprovante de renda, etc.). Para financiamento, ofereça apoio do parceiro/banco se houver na base.

**"Quero ver mais opções":**
- Envie até 3 alternativas por vez (mais que isso confunde). Marque follow-up se nenhuma servir agora.
$$, 70, 'real_estate'),

-- ============ RESTAURANT ============
('restaurant_reserva', 'Reserva de mesa', $$# Reserva de mesa

**Oferta dominante:** reserva no horário e capacidade certos.

**Roteiro curto:**
1. Confirme: data, horário, número de pessoas.
2. Verifique disponibilidade na base/agenda. Se cheio, ofereça horário alternativo (30-60 min antes/depois).
3. Pergunte se há ocasião especial (aniversário, pedido de namoro, reunião de negócios) — pode acionar atenção da equipe.
4. Pergunte restrições alimentares importantes (vegetariano, alergias).
5. Confirme nome e telefone.
6. Envie confirmação com endereço, horário de tolerância e política de cancelamento.

**Não faça:** prometer mesa específica (janela, terraço) sem confirmar; aceitar grupos acima da capacidade sem checar.
$$, 50, 'restaurant'),

('restaurant_cardapio', 'Dúvidas sobre cardápio e operação', $$# Cardápio, horário e operação

**Princípios:**
- Só responda o que está na base de conhecimento (cardápio, horários, formas de pagamento, delivery, estacionamento).
- Não invente prato, preço ou ingrediente.
- Para alergias graves (amendoim, frutos do mar, glúten celíaco), oriente avisar a equipe no local — não garanta ausência de contaminação cruzada sem confirmação.

**Perguntas frequentes — responda direto se estiver na base:**
- Horário de funcionamento por dia da semana
- Aceita reserva / quanto tempo de antecedência
- Aceita cartão / Pix / vale-refeição
- Tem opção vegetariana, vegana, sem glúten, sem lactose
- Estacionamento / valet
- Faz delivery / quais plataformas
$$, 60, 'restaurant'),

('restaurant_grupos_eventos', 'Grupos grandes e eventos', $$# Grupos grandes e eventos

**Quando o lead pede mesa para mais de 8 pessoas, evento privado ou fechamento de espaço:**
1. Pergunte: data, número de pessoas, ocasião, se quer espaço reservado ou mesa no salão.
2. Verifique se a base tem política de grupos (couvert, menu fechado, sinal, taxa de serviço).
3. Se houver menu de evento na base, ofereça.
4. Para fechamento de espaço ou >20 pessoas, transfira para humano — costuma envolver contrato.

**Política comum (confirmar na base):** sinal de reserva, número mínimo garantido, prazo de cancelamento sem cobrança.
$$, 70, 'restaurant'),

-- ============ ECOMMERCE ============
('ecommerce_recomendacao', 'Recomendação de produto', $$# Recomendação de produto

**Oferta dominante:** o produto/categoria carro-chefe do site.

**Roteiro:**
1. Pergunte o uso ou problema que quer resolver (não pergunte logo "qual modelo").
2. Recomende 1-2 produtos da base que batem, com 1 frase de justificativa cada e o link/SKU.
3. Se houver variações (cor, tamanho, voltagem), confirme antes de mandar o link.
4. Aponte diferenciais reais (garantia, frete, prazo) que estão na base.
5. Ofereça finalizar pelo site ou pelo atendimento humano se preferir.

**Não faça:** recomendar produto fora da base; inventar prazo de entrega; prometer estoque sem checar.
$$, 50, 'ecommerce'),

('ecommerce_pedido_status', 'Status de pedido e pós-venda', $$# Status, troca e devolução

**Status de pedido:**
- Peça número do pedido OU CPF/email do cliente.
- Use a ferramenta de consulta (se disponível) ou transfira para humano se não houver integração.
- Não invente status ("já saiu para entrega") sem fonte.

**Troca / devolução:**
- Confirme se está dentro do prazo legal (7 dias após recebimento para arrependimento) e do prazo da loja (na base).
- Liste documentação necessária (nota fiscal, produto na embalagem original, etc.).
- Para defeito de fabricação, oriente envio de fotos/vídeo e transfira para humano.

**Reclamação grave (produto não chegou, cobrança indevida, atendimento ruim):**
- Acolha, registre nota detalhada e transfira para humano imediatamente.
$$, 60, 'ecommerce'),

('ecommerce_objecoes', 'Objeções de e-commerce', $$# Objeções comuns — e-commerce

**"Frete está caro":**
- Verifique se há frete grátis a partir de X (na base). Sugira adicionar item para atingir.
- Mencione opção de retirada (se houver loja física).

**"Achei mais barato no concorrente":**
- Não baixe preço por conta própria. Reforce 1-2 diferenciais reais (garantia estendida, troca facilitada, autenticidade, atendimento).

**"E se não servir / não gostar?":**
- Explique a política de troca/devolução claramente. Reforça segurança da compra.

**"Demora muito para chegar":**
- Confirme prazo real para o CEP. Mencione opção expressa se houver.
$$, 70, 'ecommerce'),

-- ============ SAAS ============
('saas_qualificacao', 'Qualificação BANT/CHAMP (SaaS B2B)', $$# Qualificação de SaaS B2B

**Objetivo:** entender se o lead bate com o ICP e qual plano faz sentido.

**Pergunte com naturalidade (não despeje):**
1. Qual o cargo / função? (decisor, influenciador, usuário)
2. Tamanho da empresa (nº de pessoas / faturamento ou volume relevante para o produto)
3. Que problema/dor estão tentando resolver?
4. Já usam alguma ferramenta hoje para isso?
5. Têm prazo / projeto definido para implementar?
6. Quem precisa aprovar a compra?

**Use o resultado:**
- Se bate com ICP → ofereça o plano de entrada e proponha demo/trial.
- Se está fora do ICP (muito pequeno, muito grande, segmento errado) → seja honesto, indique alternativa se houver, agradeça.
$$, 50, 'saas'),

('saas_demo_trial', 'Agendamento de demo / ativação de trial', $$# Demo e trial

**Demo:**
1. Confirme dor e contexto (use o que já foi qualificado, não repita).
2. Ofereça 2 horários nos próximos 2-3 dias úteis.
3. Confirme quem participará da call (decisor presente aumenta conversão).
4. Envie convite com link, agenda do que será mostrado, link do produto para olhar antes.

**Trial:**
1. Crie/envie acesso (use ferramenta se disponível, ou transfira).
2. Combine um touchpoint no 3º dia: "como tá indo, posso ajudar com algo?".
3. Aponte 1-2 features-chave para o caso de uso dele explorar primeiro.

**Não faça:** prometer integração que não existe; comprometer prazo de desenvolvimento; oferecer desconto sem aprovação.
$$, 60, 'saas'),

('saas_objecoes', 'Objeções SaaS', $$# Objeções comuns — SaaS B2B

**"Preço está alto":**
- Pergunte com o que está comparando. Foque em ROI e custo da dor atual (tempo perdido, erro humano, churn).
- Se houver plano menor ou anual com desconto na base, ofereça. Não invente desconto.

**"Já temos um sistema":**
- Pergunte o que funciona e o que não funciona no atual. Posicione como complemento ou troca conforme o caso. Ofereça comparativo se houver na base.

**"Precisa aprovação do TI / financeiro":**
- Pergunte o que normalmente esses times pedem (segurança, contrato, NF). Ofereça enviar material de apoio (white paper, certificações, contrato modelo) se houver na base.

**"Vamos avaliar e voltamos":**
- Combine data específica de retorno. Ofereça enviar resumo da call e materiais. Agende follow-up.
$$, 70, 'saas'),

-- ============ LAW ============
('law_triagem', 'Triagem jurídica inicial', $$# Triagem jurídica

**Oferta dominante:** consulta com o advogado da área principal do escritório.

**Pergunte:**
1. Sobre o que precisa de ajuda? (de forma ampla, sem termo técnico)
2. É algo que já está em processo, recebeu citação, ou está pensando em iniciar?
3. Há prazo curto envolvido (audiência, intimação com prazo)?
4. É a primeira vez procurando advogado nesse assunto?

**Importante:**
- **Não dê parecer jurídico, não diga "você tem direito" ou "vai ganhar".** Diga que a análise jurídica é feita na consulta.
- Se houver prazo iminente (próximos 3 dias úteis), trate como prioritário e tente encaixar / transferir para humano hoje.
- Salve o resumo do caso em nota para o advogado ler antes da consulta.
$$, 50, 'law'),

('law_agendamento', 'Agendamento de consulta jurídica', $$# Agendamento — escritório de advocacia

**Roteiro:**
1. Confirme área (cível, trabalhista, família, criminal, tributário, etc.) — use a área principal do escritório como default.
2. Ofereça consulta com o advogado responsável da área.
3. Apresente 2-3 horários. Para urgência (prazo), priorize hoje/amanhã.
4. Confirme nome completo, telefone e se a consulta será presencial ou online.
5. Liste documentos que o cliente deve trazer/enviar antes (RG, CPF, contrato, documentos do processo, etc.) — só os que estão na base ou são óbvios.
6. Esclareça se a primeira consulta é cobrada ou de cortesia (na base).

**Sigilo:** trate todas as informações com confidencialidade. Não comente caso com terceiros nem mencione outros clientes.
$$, 60, 'law'),

('law_objecoes', 'Objeções — advocacia', $$# Objeções comuns — escritório jurídico

**"Quanto custa?":**
- Não dê valor sem avaliação. Explique que honorários dependem do caso (complexidade, fase processual, modalidade — êxito, fixo, por hora). Ofereça consulta para orçamento.

**"Vou pensar":**
- Para casos com prazo, alerte sobre o risco de perder o prazo. Para casos sem urgência, agende follow-up em 5-7 dias.

**"Já estou com outro advogado":**
- Pergunte se quer uma segunda opinião (legítimo) ou se está insatisfeito. Em qualquer caso, escale para o advogado responsável conversar.

**"Tenho vergonha do meu caso":**
- Acolha. Reforce sigilo profissional. Não force detalhes — basta o necessário para encaminhar à área certa.
$$, 70, 'law'),

-- ============ EDUCATION ============
('education_matricula', 'Matrícula no curso principal', $$# Matrícula

**Oferta dominante:** o curso/turma com mais demanda da escola.

**Roteiro:**
1. Pergunte o objetivo do aluno (carreira, hobby, certificação, reforço escolar, etc.).
2. Confirme idade / nível atual (iniciante, intermediário, avançado).
3. Ofereça já o curso/turma principal que bate com o perfil.
4. Apresente horários da próxima turma e formato (presencial, online, híbrido).
5. Explique investimento (matrícula + mensalidade) se estiver na base. Não invente desconto.
6. Confirme nome, telefone, email e combine envio do contrato / link de inscrição.

**Para menores:** confirme dados do responsável e que ele está ciente da matrícula.
$$, 50, 'education'),

('education_qualificacao', 'Qualificação do aluno', $$# Qualificação educacional

**Pergunte:**
1. Para você ou para outra pessoa (filho, equipe, etc.)?
2. Já tem alguma base no assunto?
3. Por que esse curso agora? (objetivo: profissional, acadêmico, pessoal)
4. Disponibilidade de horário (manhã, tarde, noite, fins de semana, online assíncrono)
5. Tem prazo para começar / terminar?

**Use o resultado:**
- Recomende turma e formato compatíveis. Não force presencial se a pessoa só consegue online.
- Se nenhum curso da base bate, seja honesto e marque para receber aviso de novas turmas.
$$, 60, 'education'),

('education_objecoes', 'Objeções — educação', $$# Objeções comuns — educação

**"Está caro":**
- Confirme formas de pagamento na base (parcelamento, bolsa, desconto à vista, pagamento por mensalidade). Não crie desconto por conta própria.

**"Não tenho tempo":**
- Ofereça formato mais flexível (online, assíncrono, aulas gravadas). Reforce carga horária real.

**"Não sei se é para mim":**
- Pergunte mais sobre o objetivo. Ofereça aula experimental gratuita ou conversa com coordenação se houver na base.

**"Já tentei outro curso e não terminei":**
- Acolha sem julgar. Pergunte o que faltou. Reforce diferenciais reais (suporte, mentoria, comunidade) se houver na base.
$$, 70, 'education'),

-- ============ AESTHETICS ============
('aesthetics_agendamento', 'Agendamento de procedimento estético', $$# Agendamento — estética

**Oferta dominante:** o procedimento mais procurado da clínica (ex: limpeza de pele, harmonização, depilação a laser, massagem modeladora).

**Roteiro:**
1. Pergunte qual procedimento ou qual resultado deseja (acne, rejuvenescer, redução de medidas, etc.).
2. Se for primeira vez, recomende avaliação antes do procedimento.
3. Ofereça 2-3 horários. Procedimentos longos (laser, peeling) costumam exigir agenda dupla.
4. Pergunte se está usando algum ativo (ácido, isotretinoína) ou tem condição (gestação, marca-passo, herpes ativo) — pode contraindicar. Em dúvida, transfira para profissional.
5. Combine instruções pré-procedimento (não tomar sol, suspender certos cosméticos, vir sem maquiagem).

**Não faça:** prometer resultado específico ("vai sumir 100% da estria"); contraindicar/indicar procedimento sem profissional.
$$, 50, 'aesthetics'),

('aesthetics_qualificacao', 'Triagem para procedimento estético', $$# Triagem — estética

**Pergunte:**
1. Qual o objetivo / o que incomoda?
2. Já fez algum procedimento parecido antes? Como foi?
3. Tem alguma condição de saúde, alergia, gestação, uso de medicamento contínuo?
4. Está expondo a região ao sol regularmente?
5. Prazo / ocasião (casamento, evento, viagem) — ajuda a planejar protocolo.

**Sinais para escalar imediatamente:**
- Gestação ou amamentação (muitos procedimentos contraindicados)
- Uso de isotretinoína / Roacutan recente
- Doença autoimune ativa, herpes ativo na região
- Marca-passo ou prótese metálica em algumas tecnologias

Nestes casos, transfira para o profissional avaliar antes de agendar.
$$, 60, 'aesthetics'),

('aesthetics_objecoes', 'Objeções — estética', $$# Objeções comuns — estética

**"Quanto custa?":**
- Valor depende da área, número de sessões, técnica. Ofereça avaliação (costuma ser barata ou gratuita — confirme na base) para orçamento real.

**"Dói?":**
- Seja honesto conforme a base (anestesia tópica, sensação suportável, etc.). Não minimize.

**"Quantas sessões?":**
- Dê faixa baseada na base. Reforce que o profissional define no protocolo individual.

**"Vi mais barato em outro lugar":**
- Reforce diferenciais reais: equipamento, formação do profissional, protocolo, segurança. Não baixe preço.

**"Tenho medo do resultado ficar artificial / errado":**
- Acolha. Mencione abordagem natural (se for verdade) e ofereça avaliação para alinhar expectativa.
$$, 70, 'aesthetics'),

-- ============ AGENCY ============
('agency_qualificacao', 'Qualificação de cliente (agência)', $$# Qualificação — agência / serviços B2B

**Pergunte:**
1. Tipo de empresa, segmento, porte aproximado.
2. O que está tentando resolver? (gerar lead, vender mais, posicionamento, etc.)
3. Já trabalha com agência hoje? O que funciona e o que não funciona?
4. Tem orçamento mensal / mensal definido?
5. Prazo / urgência?
6. Quem decide a contratação?

**Use o resultado:**
- Se bate com o serviço de entrada (oferta dominante), proponha proposta inicial.
- Se está fora (orçamento abaixo do mínimo, segmento que a agência não atende), seja honesto, indique alternativa se possível.
$$, 50, 'agency'),

('agency_diagnostico', 'Diagnóstico / call inicial', $$# Diagnóstico

**Oferta dominante:** o serviço de entrada da agência (ex: auditoria, planejamento, sprint inicial).

**Roteiro:**
1. Ofereça uma call de diagnóstico (15-30min) — costuma converter mais que mandar proposta direto.
2. Ofereça 2 horários nos próximos 2-3 dias úteis.
3. Peça acesso/dados que ajudem a preparar (site, contas de tráfego, dashboards) — só o necessário, com termo de confidencialidade se exigido.
4. Combine participantes (decisor presente acelera).
5. Envie agenda da call: o que será mostrado, o que será discutido.

**Não faça:** prometer resultado específico (ROI X, posicionamento garantido em 3 meses) sem dados.
$$, 60, 'agency'),

('agency_objecoes', 'Objeções — agência', $$# Objeções comuns — agência

**"Caro":**
- Pergunte com o que compara (freela, time interno, outra agência). Foque em custo da falta de resultado e em escopo entregue.

**"Já tive experiência ruim com agência":**
- Acolha. Pergunte o que faltou (transparência, resultado, atendimento). Posicione diferenciais reais.

**"Quero garantia de resultado":**
- Seja honesto: marketing não tem garantia matemática. Pode oferecer KPIs claros, revisão mensal, cláusula de saída se houver na base.

**"Vou pensar / falar com sócio":**
- Combine data de retorno. Ofereça enviar resumo da conversa, cases, proposta resumida.
$$, 70, 'agency'),

-- ============ LOCAL SERVICES ============
('local_agendamento', 'Agendamento de serviço local', $$# Agendamento — serviços locais

**Oferta dominante:** o serviço mais pedido (encanamento, elétrica, dedetização, ar-condicionado, etc.).

**Roteiro:**
1. Confirme: qual serviço, descrição do problema (1 frase), urgência.
2. Confirme região / endereço — se fora da área de atendimento da base, seja honesto e finalize educadamente.
3. Ofereça visita técnica para orçamento (se aplicável) ou agende serviço direto se o tipo for padronizado.
4. Apresente 2-3 janelas de horário.
5. Confirme nome, telefone, endereço completo e ponto de referência.
6. Combine: técnico vai entrar em contato 30min antes, levar EPI/identificação, formas de pagamento aceitas.

**Para emergência (vazamento, curto-circuito, infestação grave):** priorize encaixe no mesmo dia.
$$, 50, 'local_services'),

('local_orcamento', 'Orçamento à distância', $$# Orçamento sem visita

**Princípios:**
- Para serviços simples e padronizados que estão na base (ex: dedetização de apto até X m², limpeza de caixa d'água até X litros), pode passar faixa de preço.
- Para serviços complexos (reforma, instalação grande, problema não identificado), **não chute valor** — ofereça visita técnica gratuita ou de baixo custo.
- Sempre diga "faixa estimada" ou "depende de avaliação". Nunca prometa "vai custar exatamente X".

**Pergunte para estimar:**
- Tamanho do imóvel / da área
- Idade / condição (instalação antiga? primeira vez?)
- Foto/vídeo do problema (ajuda muito)
- Acesso (apto alto sem elevador, área de difícil acesso, etc.)
$$, 60, 'local_services'),

('local_objecoes', 'Objeções — serviços locais', $$# Objeções comuns — serviços locais

**"Está caro":**
- Liste o que está incluso (mão de obra, material, garantia, deslocamento). Compare honestamente. Se a base permite, ofereça parcelamento ou pacote.

**"O concorrente cobrou metade":**
- Reforce diferenciais reais: técnico identificado, garantia, NF, empresa registrada. Não baixe preço.

**"Preciso só de um conserto rápido":**
- Pergunte detalhes. Se for de fato simples, agende rápido. Se descrição indica problema maior, alerte que o técnico pode identificar mais coisas e o orçamento real só sai no local.

**"E se não resolver?":**
- Explique a garantia da base (X dias de retorno sem custo). Reforça confiança.
$$, 70, 'local_services');
