---
title: "Supabase Migrations"
topic: database
kind: map
audience: agent
updated: 2026-07-10
summary: "Mapeamento das migrations do banco de dados, contendo a história de alterações do schema e RLS."
code_refs:
  - supabase/migrations/
related_docs:
  - docs/database/SCHEMA.md
---

# Migrations do Supabase

## 1. Visão Geral
Este documento mapeia o diretório `supabase/migrations/`, que contém a trilha de auditoria completa e executável das mudanças estruturais no banco de dados.

## 2. Padrões de Migration
Todas as migrations seguem o formato de timestamp do Supabase CLI (`YYYYMMDDHHMMSS_nome_da_migration.sql`).
Elas contêm:
- **DDL (Data Definition Language)**: `CREATE TABLE`, `ALTER TABLE`, adição de novas colunas.
- **RLS (Row Level Security)**: Definições de políticas de segurança (`CREATE POLICY`) atreladas à tabela e aos roles (geralmente `authenticated` ou `anon`).
- **Triggers & Functions**: Regras granulares que executam ao inserir/atualizar linhas (ex: cálculo automático de totais, logs).

### Invariantes e Regras
- **NUNCA** alterar uma migration antiga que já foi mesclada. Se houver erro estrutural no banco, uma nova migration deve ser criada corrigindo o erro.
- Ao adicionar novas tabelas, certifique-se de **Sempre** habilitar o RLS via `ALTER TABLE public.<nome> ENABLE ROW LEVEL SECURITY;`.
- Todas as migrations geradas pelo Lovable ficam aqui e ditam a fonte da verdade estrutural da aplicação.
