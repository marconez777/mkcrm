// Detecção de mensagens-template do wa-redirect.
//
// Toda mensagem inicial disparada via /wa-redirect tem a estrutura:
//
//   <frase do CTA / teste>
//   ---
//   *Mantenha esse código na sua mensagem para entrar na fila de atendimento:*
//   (ref=XXXXXXXX)
//
// Isso NÃO foi digitado pelo lead — é texto fixo do site. O extractor não
// deve tratar verbos como "gostaria de agendar" como intenção real.

export const WA_REDIRECT_MARKER_RE =
  /\*Mantenha esse c[óo]digo na sua mensagem para entrar na fila de atendimento:?\*/i;
export const WA_REDIRECT_REF_RE = /\(ref=[a-z0-9]{6,}\)/i;

export interface CtaPattern {
  /** Regex que casa um trecho identificador na frase-base do CTA. */
  match: RegExp;
  /** Tag a ser aplicada ao lead. */
  tag: string;
  /** Procedimento inferido (mesmo enum do extractor: cetamina/emt/hipnoterapia/...). */
  procedimento?: "cetamina" | "emt" | "hipnoterapia" | "terapia" | null;
  /** Descrição curta usada em prompt / logs. */
  label: string;
}

// Ordem importa: padrões mais específicos primeiro.
export const KNOWN_CTAS: CtaPattern[] = [
  {
    match: /teste de depress[ãa]o\s+phq-?9|\bphq-?9\b/i,
    tag: "lead-phq9",
    label: "Teste PHQ-9 (depressão)",
  },
  {
    match: /\bgad-?7\b|teste de ansiedade/i,
    tag: "lead-gad7",
    label: "Teste GAD-7 (ansiedade)",
  },
  {
    match: /teste de depress[ãa]o/i,
    tag: "lead-teste-depressao",
    label: "Teste de depressão (genérico)",
  },
  {
    match: /tratamento com\s+emt|estimula[çc][ãa]o magn[ée]tica|\bemtr?\b/i,
    tag: "lead-emt",
    procedimento: "emt",
    label: "CTA EMT",
  },
  {
    match: /\bcetamina\b|\bescetamina\b|\bspravato\b|\binfus[ãa]o\b/i,
    tag: "lead-cetamina",
    procedimento: "cetamina",
    label: "CTA Cetamina",
  },
  {
    match: /\bhipnose\b|hipnoterapia/i,
    tag: "lead-hipnose",
    procedimento: "hipnoterapia",
    label: "CTA Hipnose",
  },
];

export interface DetectedOrigin {
  /** Mensagem é um template do wa-redirect (tem o marcador). */
  isTemplate: boolean;
  /** Tag para aplicar em leads.tags (null se isTemplate=false). */
  tag: string | null;
  /** Procedimento inferido pelo CTA (se houver). */
  procedimento: CtaPattern["procedimento"] | null;
  /** Label curto do CTA detectado (para logs/prompt). */
  cta: string | null;
}

/**
 * Inspeciona uma mensagem (texto cru) e devolve a origem se for template
 * do wa-redirect. Retorna { isTemplate:false } caso contrário.
 */
export function detectOrigin(text: string | null | undefined): DetectedOrigin {
  if (!text) return { isTemplate: false, tag: null, procedimento: null, cta: null };
  const hasMarker = WA_REDIRECT_MARKER_RE.test(text) || WA_REDIRECT_REF_RE.test(text);
  if (!hasMarker) return { isTemplate: false, tag: null, procedimento: null, cta: null };

  // Pega só a parte ANTES do bloco "---" (a frase-base do CTA).
  const base = text.split(/\n-{3,}\n?/)[0] ?? text;
  for (const pat of KNOWN_CTAS) {
    if (pat.match.test(base)) {
      return {
        isTemplate: true,
        tag: pat.tag,
        procedimento: pat.procedimento ?? null,
        cta: pat.label,
      };
    }
  }
  // Template reconhecido mas CTA não casa em nenhum padrão: genérico do site.
  return { isTemplate: true, tag: "lead-site", procedimento: null, cta: "CTA genérico do site" };
}

/**
 * True se a mensagem é APENAS template (frase-base + bloco do código),
 * sem nada digitado pelo lead depois do `(ref=...)`.
 */
export function isTemplateOnly(text: string | null | undefined): boolean {
  if (!text) return false;
  const m = text.match(WA_REDIRECT_REF_RE);
  if (!m) return WA_REDIRECT_MARKER_RE.test(text); // marker sem ref ainda conta
  const idx = (m.index ?? 0) + m[0].length;
  const tail = text.slice(idx).trim();
  // Aceita whitespace/quebras/pontuação leve depois do (ref=...)
  return tail.length === 0 || /^[\s.!?\-–—]+$/.test(tail);
}

/** Lista de labels usada no prompt do extractor. */
export function knownCtaLabels(): string[] {
  return KNOWN_CTAS.map((c) => `- ${c.label}`);
}
