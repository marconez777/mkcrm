
INSERT INTO public.lead_custom_fields (clinic_id, field_key, label, field_type, options, position)
SELECT c.id, f.field_key, f.label, f.field_type, f.options::jsonb, f.position + 100
FROM public.clinics c
CROSS JOIN (VALUES
  ('status_financeiro', 'Status Financeiro', 'select', '["pago","pendente","parcial","atrasado","nao_aplicavel"]', 1),
  ('status_consulta', 'Status da Consulta', 'select', '["agendada","realizada","faltou","cancelada"]', 2),
  ('interesse_consulta', 'Interesse em Consulta', 'boolean', NULL, 3),
  ('interesse_tratamento', 'Interesse em Tratamento', 'boolean', NULL, 4),
  ('ciclo_concluido', 'Ciclo Concluído', 'boolean', NULL, 5),
  ('sessoes_realizadas', 'Sessões Realizadas', 'number', NULL, 6),
  ('nome_responsavel_financeiro', 'Responsável Financeiro', 'text', NULL, 7),
  ('possui_liminar_judicial', 'Possui Liminar Judicial', 'boolean', NULL, 8),
  ('saldo_sessoes_pacote', 'Saldo de Sessões (Pacote)', 'number', NULL, 9),
  ('pagamento_alegado_em', 'Pagamento Alegado em', 'datetime', NULL, 10),
  ('data_solicitacao_nf', 'Data Solicitação NF', 'datetime', NULL, 11),
  ('modalidade_preferida', 'Modalidade Preferida', 'select', '["presencial","online","indiferente"]', 12),
  ('motivo_cancelamento', 'Motivo de Cancelamento', 'text', NULL, 13)
) AS f(field_key, label, field_type, options, position)
ON CONFLICT (clinic_id, field_key) DO NOTHING;

INSERT INTO public.app_settings (key, value) VALUES
  ('automation.v42.motivo_desqualificacao_enum',
   '["nao_publico_alvo","sem_interesse","sem_orcamento","fora_de_area","contato_invalido","duplicado","concorrente","spam","desistiu","sem_resposta_prolongada","outro"]'),
  ('automation.v42.allowed_tags',
   '["reagendamento_pendente","retorno_pendente","nf_pendente","pagamento_pendente","paciente_antigo","reativacao","judicializacao","renovacao_receita","lead_b2b","precisa_atencao_humana","post_move_warning","ciclo_concluido","modalidade_online","modalidade_presencial","manual_lock","aguardando_secretaria"]'),
  ('automation.v42.custom_fields_schema',
   '{"status_financeiro":{"type":"select","values":["pago","pendente","parcial","atrasado","nao_aplicavel"]},"status_consulta":{"type":"select","values":["agendada","realizada","faltou","cancelada"]},"interesse_consulta":{"type":"boolean"},"interesse_tratamento":{"type":"boolean"},"ciclo_concluido":{"type":"boolean"},"sessoes_realizadas":{"type":"number"},"nome_responsavel_financeiro":{"type":"text"},"possui_liminar_judicial":{"type":"boolean"},"saldo_sessoes_pacote":{"type":"number"},"pagamento_alegado_em":{"type":"datetime"},"data_solicitacao_nf":{"type":"datetime"},"modalidade_preferida":{"type":"select","values":["presencial","online","indiferente"]},"motivo_cancelamento":{"type":"text"}}')
ON CONFLICT (key) DO NOTHING;
