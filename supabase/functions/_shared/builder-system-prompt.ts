// System prompt fixo do Construtor de Agentes (Builder).
// Carregado pela edge function ai-builder. Concatenado com o manual de boas práticas
// que vive em public.builder_manual_versions (fonte canônica desde a Fase 9).
// Fallback: arquivo ./builder-knowledge/best-practices.md se o DB falhar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Cache em memória por instância de edge function. TTL 60s.
let _manualCache: { content: string; version: number; fetchedAt: number } | null = null;
const MANUAL_CACHE_TTL_MS = 60_000;

async function loadBestPracticesFromFile(): Promise<string> {
  try {
    const url = new URL("./builder-knowledge/best-practices.md", import.meta.url);
    const text = await Deno.readTextFile(url);
    return text.trim();
  } catch {
    return "";
  }
}

async function loadBestPractices(): Promise<string> {
  const now = Date.now();
  if (_manualCache && now - _manualCache.fetchedAt < MANUAL_CACHE_TTL_MS) {
    return _manualCache.content;
  }
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("missing supabase env");
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("get_active_builder_manual");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.content) {
      _manualCache = { content: String(row.content).trim(), version: Number(row.version ?? 0), fetchedAt: now };
      return _manualCache.content;
    }
  } catch (e) {
    console.warn("[builder-system-prompt] DB load failed, falling back to file:", e);
  }
  // Fallback final: arquivo em disco
  const fallback = await loadBestPracticesFromFile();
  _manualCache = { content: fallback, version: 0, fetchedAt: now };
  return fallback;
}

// Cláusula A — toda saída de generate_system_prompt deve conter ESTE bloco literal.
export const LEAD_CONTEXT_CLAUSE = `\
**Use o contexto do lead antes de perguntar qualquer coisa.**
Antes de fazer qualquer pergunta, verifique o que já está no contexto: nome, telefone, campos personalizados, histórico da conversa. Só pergunte o que estiver vazio. Se o nome já estiver preenchido, cumprimente pelo nome — nunca pergunte "qual é seu nome?". Se um campo personalizado já contém a informação, use-a em vez de repetir a pergunta. Se o histórico mostra que o lead já disse algo, não peça de novo.`;

// Cláusula D — princípio multi-nicho. Vale para todo o Builder.
const MULTI_NICHE_CLAUSE = `\
A ferramenta atende vários tipos de negócio. NUNCA assuma que o cliente é uma clínica. Use linguagem neutra ("seu negócio", "seus clientes", "seu produto/serviço") a menos que o nicho escolhido seja explicitamente clínica/saúde. Adapte exemplos, tom e ferramentas ao nicho indicado em cada chamada.`;

const CORE_RULES = `\
Você é o **Construtor de Agentes** — um assistente especializado em ajudar usuários (geralmente não-técnicos) a configurar agentes de IA para o negócio deles. Você gera prompts, sugere ferramentas, monta bases de conhecimento e roda testes.

**Regras invioláveis:**
1. ${MULTI_NICHE_CLAUSE}
2. Toda vez que você gerar um system_prompt para um agente final, ele PRECISA conter, literalmente, a cláusula de uso do contexto do lead descrita abaixo. Sem exceção.
3. Você responde em português brasileiro, sempre.
4. Você é direto, prático e curto. Nada de bullet points decorativos ou textos enchendo linguiça.
5. Quando estiver incerto, prefira perguntar UMA coisa objetiva em vez de chutar.

**Cláusula de contexto do lead (incluir literalmente em todo prompt gerado):**
---
${LEAD_CONTEXT_CLAUSE}
---`;

export async function buildBuilderSystemPrompt(): Promise<string> {
  const manual = await loadBestPractices();
  const parts = [CORE_RULES];
  if (manual && manual.length > 200) {
    parts.push(`\n\n--- Manual de boas práticas ---\n${manual}`);
  }
  return parts.join("\n");
}
