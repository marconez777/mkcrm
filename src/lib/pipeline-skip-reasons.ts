// Mapa de motivos de skip/erro do pipeline-classify para texto humano.
// Cobre tanto reasons curtos (`no_new_messages`) quanto prefixados
// (`agent_step1_failed: ...`, `agent_error:summarizer_failed`).

export type SkipReasonInfo = {
  label: string;
  desc: string;
  tone: "neutral" | "info" | "warn" | "error";
  agent?: "summarizer" | "typifier" | "maestro";
};

const TABLE: Record<string, SkipReasonInfo> = {
  no_messages: {
    label: "Sem mensagens",
    desc: "Lead ainda não trocou mensagens — não há o que classificar.",
    tone: "neutral",
  },
  no_new_messages: {
    label: "Sem novidade",
    desc: "Nada novo desde a última classificação (watermark da última mensagem).",
    tone: "info",
  },
  no_pipeline: {
    label: "Sem pipeline",
    desc: "Lead não está em nenhum pipeline ativo.",
    tone: "warn",
  },
  lead_not_found: {
    label: "Lead inexistente",
    desc: "O lead foi removido entre o enfileiramento e a execução.",
    tone: "warn",
  },
  clinic_not_allowlisted: {
    label: "Empresa não autorizada",
    desc: "Feature pipeline-classifier não está habilitada para esta empresa.",
    tone: "warn",
  },
  toggle_off: {
    label: "IA pausada",
    desc: "Toggle automation.classifier.enabled está desligado.",
    tone: "warn",
  },
  no_clinic_openai_key: {
    label: "Sem chave OpenAI",
    desc: "Empresa não tem clinic_openai key configurada — agente não pôde rodar.",
    tone: "error",
  },
  worker_timeout_no_heartbeat: {
    label: "Worker travou",
    desc: "Worker do executor parou de bater heartbeat por mais de 3 min — marcado como erro.",
    tone: "error",
  },
  classify_timeout_55s: {
    label: "Timeout antigo 55s",
    desc: "Run antigo marcou timeout em 55 s; o limite atual foi aumentado para 120 s.",
    tone: "error",
  },
  classify_timeout_120s: {
    label: "Timeout 120s",
    desc: "Chamada ao classify estourou 120 s — possível travamento do modelo ou cold start.",
    tone: "error",
  },
};

const AGENT_FAILURES: Record<string, SkipReasonInfo> = {
  agent_step1_failed: {
    label: "Resumidor falhou",
    desc: "Agente 1 (gpt-4o) devolveu erro/JSON inválido — veja a mensagem original abaixo.",
    tone: "error",
    agent: "summarizer",
  },
  agent_step2_failed: {
    label: "Tipificador falhou",
    desc: "Agente 2 (gpt-5-mini) devolveu erro/JSON inválido.",
    tone: "error",
    agent: "typifier",
  },
  agent_step3_failed: {
    label: "Maestro falhou",
    desc: "Agente 3 (gpt-5-mini) devolveu erro/JSON inválido.",
    tone: "error",
    agent: "maestro",
  },
};

/**
 * Resolve um motivo cru (vindo de `result.skipped`, `item.error`, ou de
 * `agent_error:<x>`) em um SkipReasonInfo. Faz best-effort matching.
 */
export function describeReason(raw: string | null | undefined): SkipReasonInfo {
  if (!raw) return { label: "—", desc: "", tone: "neutral" };
  const trimmed = raw.trim();

  // Exact match
  if (TABLE[trimmed]) return TABLE[trimmed];

  // agent_step{N}_failed: <msg>
  for (const prefix of Object.keys(AGENT_FAILURES)) {
    if (trimmed.startsWith(prefix)) {
      const orig = trimmed.slice(prefix.length).replace(/^:\s*/, "");
      const base = AGENT_FAILURES[prefix];
      return {
        ...base,
        desc: orig ? `${base.desc} Detalhe: ${orig.slice(0, 200)}` : base.desc,
      };
    }
  }

  // agent_error:<reason>
  if (trimmed.startsWith("agent_error:")) {
    const inner = trimmed.slice("agent_error:".length);
    return {
      label: "Erro do agente",
      desc: `O classificador parou com erro: ${inner.slice(0, 200)}`,
      tone: "error",
    };
  }

  // http_<status>
  if (/^http_\d+$/.test(trimmed)) {
    return {
      label: trimmed.toUpperCase().replace("_", " "),
      desc: "Resposta HTTP não-ok da função pipeline-classify.",
      tone: "error",
    };
  }

  // Fallback
  return {
    label: trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed,
    desc: trimmed,
    tone: "warn",
  };
}

export function toneClasses(tone: SkipReasonInfo["tone"]): string {
  switch (tone) {
    case "info":
      return "bg-blue-500/10 text-blue-300 border-blue-500/30";
    case "warn":
      return "bg-amber-500/10 text-amber-300 border-amber-500/30";
    case "error":
      return "bg-red-500/10 text-red-300 border-red-500/30";
    default:
      return "bg-slate-500/10 text-slate-300 border-slate-500/30";
  }
}
