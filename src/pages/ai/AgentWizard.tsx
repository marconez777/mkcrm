import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  Settings as SettingsIcon,
  Power,
  FileText,
  FlaskConical,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BUILDER_TOOLTIPS, type TooltipKey } from "@/lib/builder-tooltips";
import { parseBuilderError, type ProviderError } from "@/lib/builder-errors";
import { ProviderErrorBanner } from "@/components/agents/ProviderErrorBanner";
import { filterKnownTools } from "@/lib/agent-tools";

// ---------- Tipos / constantes ----------

type Step = 1 | 2 | 3 | 4 | 5;
type Provider = "openai" | "anthropic" | "google" | "xai";

export interface InterviewQuestion {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  kind: "dominant_offer" | "tone" | "taboo" | "qualification" | "escalation" | "context" | "custom";
  required: boolean;
}

export interface GeneratedPromptBundle {
  system_prompt: string;
  suggested_tools: string[];
  suggested_temperature: number;
  suggested_top_k: number;
  suggested_max_iterations: number;
  rationale: string;
  evals?: { context_clause_present?: boolean };
}

interface NicheOption {
  id: string;
  label: string;
  example: string;
  emoji: string;
}

const NICHES: NicheOption[] = [
  { id: "clinic", label: "Clínica / Saúde", example: "Consultórios, dermato, odonto", emoji: "🩺" },
  { id: "real_estate", label: "Imobiliária", example: "Locação e venda de imóveis", emoji: "🏠" },
  { id: "restaurant", label: "Restaurante / Food", example: "Reservas e delivery", emoji: "🍽️" },
  { id: "ecommerce", label: "E-commerce", example: "Loja online de produtos", emoji: "🛒" },
  { id: "saas", label: "SaaS / Software B2B", example: "Trial, demo, qualificação", emoji: "💻" },
  { id: "law", label: "Advocacia", example: "Triagem por área jurídica", emoji: "⚖️" },
  { id: "education", label: "Educação", example: "Cursos, escolas, mentorias", emoji: "🎓" },
  { id: "aesthetics", label: "Estética / Beleza", example: "Procedimentos, salões", emoji: "💆" },
  { id: "dental", label: "Odontologia", example: "Consultórios odontológicos", emoji: "🦷" },
  { id: "agency", label: "Agência / Serviços B2B", example: "Marketing, design, consultoria", emoji: "🧩" },
  { id: "local_services", label: "Serviços locais", example: "Reformas, limpeza, oficina", emoji: "🔧" },
  { id: "other", label: "Outro", example: "Descreva o seu negócio", emoji: "✨" },
];

interface GoalOption {
  id: string;
  label: string;
  description: string;
}

const GOALS: GoalOption[] = [
  {
    id: "sdr",
    label: "Qualificar e agendar (SDR)",
    description: "Recebe o lead, descobre necessidade, oferece a oferta principal e agenda.",
  },
  {
    id: "classifier",
    label: "Classificar conversas",
    description: "Lê a mensagem, identifica intenção e move o lead para o estágio certo.",
  },
  {
    id: "support",
    label: "Suporte / dúvidas",
    description: "Responde dúvidas com base na sua base de conhecimento e escala quando preciso.",
  },
  {
    id: "scheduler",
    label: "Agendador",
    description: "Foco em encaixar horários, confirmar e lembrar — sem qualificação longa.",
  },
  {
    id: "custom",
    label: "Outro fluxo",
    description: "Descreva o objetivo livremente e o Construtor adapta.",
  },
];

const PROVIDERS: { id: Provider; label: string; defaultModel: string; placeholder: string; baseExample: string }[] = [
  {
    id: "openai",
    label: "OpenAI (GPT)",
    defaultModel: "gpt-4o-mini",
    placeholder: "sk-...",
    baseExample: "https://api.openai.com/v1",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-3-5-haiku-latest",
    placeholder: "sk-ant-...",
    baseExample: "https://api.anthropic.com/v1",
  },
  {
    id: "google",
    label: "Google (Gemini)",
    defaultModel: "gemini-2.5-flash",
    placeholder: "AIza...",
    baseExample: "https://generativelanguage.googleapis.com/v1beta",
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    defaultModel: "grok-2-mini",
    placeholder: "xai-...",
    baseExample: "https://api.x.ai/v1",
  },
];

const MODELS_BY_PROVIDER: Record<Provider, { value: string; label: string; hint?: string }[]> = {
  openai: [
    { value: "gpt-4o-mini", label: "gpt-4o-mini", hint: "Rápido e barato" },
    { value: "gpt-4o", label: "gpt-4o", hint: "Equilíbrio" },
    { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
    { value: "gpt-4.1", label: "gpt-4.1", hint: "Qualidade" },
    { value: "gpt-5-nano", label: "gpt-5-nano" },
    { value: "gpt-5-mini", label: "gpt-5-mini" },
    { value: "gpt-5", label: "gpt-5", hint: "Top" },
    { value: "o3-mini", label: "o3-mini" },
    { value: "o4-mini", label: "o4-mini" },
  ],
  anthropic: [
    { value: "claude-3-5-haiku-latest", label: "claude-3-5-haiku-latest", hint: "Rápido" },
    { value: "claude-3-5-sonnet-latest", label: "claude-3-5-sonnet-latest", hint: "Equilíbrio" },
    { value: "claude-opus-4-20250514", label: "claude-opus-4", hint: "Qualidade" },
  ],
  google: [
    { value: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite", hint: "Rápido" },
    { value: "gemini-2.5-flash", label: "gemini-2.5-flash", hint: "Equilíbrio" },
    { value: "gemini-2.5-pro", label: "gemini-2.5-pro", hint: "Qualidade" },
  ],
  xai: [
    { value: "grok-2-mini", label: "grok-2-mini", hint: "Rápido" },
    { value: "grok-2-latest", label: "grok-2-latest", hint: "Qualidade" },
  ],
};

const CUSTOM_MODEL = "__custom__";

interface DraftRow {
  id: string;
  clinic_id: string;
  user_id: string;
  step: number;
  niche: string | null;
  niche_other: string | null;
  goal: string | null;
  goal_other: string | null;
  provider: string | null;
  api_key?: string | null;
  base_url: string | null;
  model: string | null;
  provider_verified_at: string | null;
  interview_answers: Record<string, string> | null;
  generated_prompt: string | null;
  settings: Record<string, unknown> | null;
}

// ---------- Página ----------

export default function AgentWizard() {
  const nav = useNavigate();
  const { membership, user, loading } = useAuth();
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>(1);

  // form state
  const [niche, setNiche] = useState<string>("");
  const [nicheOther, setNicheOther] = useState("");
  const [goal, setGoal] = useState<string>("");
  const [goalOther, setGoalOther] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  // connection test
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<ProviderError | null>(null);

  // interview (step 4)
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewError, setInterviewError] = useState<ProviderError | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // prompt (step 5)
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<ProviderError | null>(null);
  const [bundle, setBundle] = useState<GeneratedPromptBundle | null>(null);
  const [refinement, setRefinement] = useState("");
  const [agentName, setAgentName] = useState("");
  const [creating, setCreating] = useState(false);

  // Builder configuration guard
  const [builderStatus, setBuilderStatus] = useState<"checking" | "ok" | "missing">("checking");
  const [builderInfo, setBuilderInfo] = useState<{
    id: string;
    provider: string;
    model: string;
    base_url: string | null;
    api_key_set: boolean;
  } | null>(null);

  // Origem da chave no passo 3: reusar Builder ou usar chave própria
  const [keySource, setKeySource] = useState<"builder" | "own">("builder");


  // Success modal post-creation
  const [successAgentId, setSuccessAgentId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  // Prompt generation timeout tracking
  const [promptTimeoutWarning, setPromptTimeoutWarning] = useState(false);
  const [promptTimedOut, setPromptTimedOut] = useState(false);
  const promptTimersRef = useRef<{ warn?: number; fail?: number }>({});

  const clinicId = membership?.clinic_id ?? null;
  const userId = user?.id ?? null;
  const canManage =
    membership?.role === "owner" || membership?.role === "admin";


  // Hidrata draft
  useEffect(() => {
    document.title = "Construtor de Agentes — MK CRM";
  }, []);

  // Verifica se Builder está configurado para a clínica antes de renderizar o wizard
  useEffect(() => {
    if (loading || !clinicId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .rpc("get_builder_agent_for_clinic", { _clinic_id: clinicId });
        if (cancelled) return;
        if (error) {
          console.warn("[AgentWizard] builder check failed:", error.message);
          setBuilderStatus("ok");
          return;
        }
        const data = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
        const ok = !!(data && data.builder_verified_at && data.api_key_set);
        setBuilderStatus(ok ? "ok" : "missing");
        if (data) {
          setBuilderInfo({
            id: data.id,
            provider: (data.provider as string) ?? "openai",
            model: (data.model as string) ?? "",
            base_url: (data.base_url as string | null) ?? null,
            api_key_set: !!(data.api_key_set ?? false),
          });
        }
        if (!ok) setKeySource("own");
      } catch (e) {
        console.warn("[AgentWizard] builder check exception:", e);
        if (!cancelled) setBuilderStatus("ok");
      }

    })();
    return () => {
      cancelled = true;
    };
  }, [loading, clinicId]);

  useEffect(() => {
    if (loading || !clinicId || !userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ai_agent_drafts")
        .select("id, clinic_id, user_id, step, niche, niche_other, goal, goal_other, provider, base_url, model, provider_verified_at, interview_answers, generated_prompt, settings, created_at, updated_at")
        .eq("clinic_id", clinicId)
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const d = data as DraftRow;

        // Detecta rascunho "órfão" — passo 5 com prompt mas agente já foi criado recentemente
        if (d.step === 5 && d.generated_prompt) {
          try {
            const { data: recentAgent } = await supabase
              .from("ai_agents")
              .select("id, name, created_at")
              .eq("clinic_id", clinicId)
              .neq("system_key", "builder")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            if (
              recentAgent &&
              recentAgent.created_at &&
              new Date(recentAgent.created_at) > tenMinutesAgo
            ) {
              await supabase
                .from("ai_agent_drafts")
                .delete()
                .eq("clinic_id", clinicId)
                .eq("user_id", userId);
              if (cancelled) return;
              toast.message("Rascunho recuperado", {
                description: `Seu agente "${recentAgent.name}" já foi criado. Redirecionando…`,
              });
              nav(`/ai/agents?agent=${recentAgent.id}`);
              return;
            }
          } catch (e) {
            console.warn("[AgentWizard] orphan draft check failed:", e);
          }
        }

        setDraft(d);
        setStep(Math.min(5, Math.max(1, d.step)) as Step);
        setNiche(d.niche ?? "");
        setNicheOther(d.niche_other ?? "");
        setGoal(d.goal ?? "");
        setGoalOther(d.goal_other ?? "");
        if (d.provider) setProvider(d.provider as Provider);
        setApiKey(d.api_key ?? "");
        setBaseUrl(d.base_url ?? "");
        if (d.model) setModel(d.model);
        setVerifiedAt(d.provider_verified_at ?? null);
        const savedKeySource = (d.settings as Record<string, unknown>)?.key_source;
        if (savedKeySource === "builder" || savedKeySource === "own") {
          setKeySource(savedKeySource as "builder" | "own");
        }
        setAnswers((d.interview_answers as Record<string, string>) ?? {});
        if (d.generated_prompt) {
          setBundle({
            system_prompt: d.generated_prompt,
            suggested_tools: ((d.settings as Record<string, unknown>)?.suggested_tools as string[]) ?? [],
            suggested_temperature:
              ((d.settings as Record<string, unknown>)?.suggested_temperature as number) ?? 0.4,
            suggested_top_k:
              ((d.settings as Record<string, unknown>)?.suggested_top_k as number) ?? 6,
            suggested_max_iterations:
              ((d.settings as Record<string, unknown>)?.suggested_max_iterations as number) ?? 6,
            rationale: ((d.settings as Record<string, unknown>)?.rationale as string) ?? "",
            evals: (d.settings as Record<string, unknown>)?.evals as { context_clause_present?: boolean } | undefined,
          });
        }
        const savedName = (d.settings as Record<string, unknown>)?.agent_name;
        if (typeof savedName === "string") setAgentName(savedName);
      }
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, clinicId, userId, nav]);


  // Ao trocar provider, sugere modelo default se vazio
  useEffect(() => {
    const def = PROVIDERS.find((p) => p.id === provider)?.defaultModel ?? "";
    if (!model && def) setModel(def);
  }, [provider, model]);

  if (loading) return null;
  if (!membership) return <Navigate to="/auth" replace />;
  if (!canManage) return <Navigate to="/ai/agents" replace />;

  // ---------- Persistência ----------

  async function persist(patch: Partial<DraftRow>) {
    if (!clinicId || !userId) return;
    setSaving(true);
    try {
      const payload = {
        clinic_id: clinicId,
        user_id: userId,
        step,
        niche: niche || null,
        niche_other: nicheOther || null,
        goal: goal || null,
        goal_other: goalOther || null,
        provider,
        api_key: apiKey || null,
        base_url: baseUrl || null,
        model: model || null,
        provider_verified_at: verifiedAt,
        ...patch,
      };
      const { data, error } = await supabase
        .from("ai_agent_drafts")
        .upsert(payload as never, { onConflict: "clinic_id,user_id" })
        .select("id, clinic_id, user_id, step, niche, niche_other, goal, goal_other, provider, base_url, model, provider_verified_at, interview_answers, generated_prompt, settings, created_at, updated_at")
        .maybeSingle();
      if (error) throw error;
      if (data) setDraft(data as DraftRow);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao salvar progresso";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // ---------- Validações por etapa ----------

  const canNextFromStep1 =
    !!niche && (niche !== "other" || nicheOther.trim().length >= 2);
  const canNextFromStep2 =
    !!goal && (goal !== "custom" || goalOther.trim().length >= 4);
  const isVerified = !!verifiedAt && !testError;
  const canNextFromStep3 =
    keySource === "builder"
      ? builderStatus === "ok" && !!(builderInfo?.api_key_set)
      : !!apiKey && !!model && isVerified;


  const canNextFromStep4 = questions
    .filter((q) => q.required)
    .every((q) => (answers[q.id] ?? "").trim().length > 0);
  const canFinish = !!bundle?.system_prompt;

  // ---------- Ações ----------

  async function goNext() {
    const target = (step + 1) as Step;
    setStep(target);
    await persist({ step: target });
    if (target === 4 && questions.length === 0) await loadInterview();
    if (target === 5 && !bundle) await generatePrompt();
  }
  async function goPrev() {
    if (step === 1) {
      nav("/ai/agents");
      return;
    }
    const target = (step - 1) as Step;
    setStep(target);
    await persist({ step: target });
  }

  async function loadInterview() {
    if (!clinicId) return;
    setInterviewLoading(true);
    setInterviewError(null);
    const { data, error } = await supabase.functions.invoke("ai-builder", {
      body: {
        action: "interview_plan",
        clinic_id: clinicId,
        payload: { niche, niche_other: nicheOther, goal, goal_other: goalOther },
      },
    });
    setInterviewLoading(false);
    if (error) {
      const parsed = parseBuilderError({ message: error.message });
      setInterviewError(parsed);
      toast.error(parsed.title);
      return;
    }
    const result = data as { ok?: boolean; questions?: InterviewQuestion[] } & Record<string, unknown>;
    if (!result?.ok || !result.questions) {
      const parsed = parseBuilderError(result);
      setInterviewError(parsed);
      toast.error(parsed.title);
      return;
    }
    setQuestions(result.questions);
  }

  function skipAllWithDefaults() {
    const defaults: Record<string, string> = {};
    for (const q of questions) {
      if (!answers[q.id]) defaults[q.id] = q.placeholder || "(use o padrão)";
    }
    setAnswers((a) => ({ ...a, ...defaults }));
    toast.message("Respostas preenchidas com padrões. Você pode editar antes de avançar.");
  }

  function clearPromptTimers() {
    if (promptTimersRef.current.warn) {
      window.clearTimeout(promptTimersRef.current.warn);
      promptTimersRef.current.warn = undefined;
    }
    if (promptTimersRef.current.fail) {
      window.clearTimeout(promptTimersRef.current.fail);
      promptTimersRef.current.fail = undefined;
    }
  }

  async function generatePrompt(extraRefinement?: string) {
    if (!clinicId) return;
    setPromptLoading(true);
    setPromptError(null);
    setPromptTimeoutWarning(false);
    setPromptTimedOut(false);
    clearPromptTimers();
    promptTimersRef.current.warn = window.setTimeout(() => {
      setPromptTimeoutWarning(true);
      toast.message("A geração está demorando mais que o esperado. Aguarde mais um momento…");
    }, 30000);
    promptTimersRef.current.fail = window.setTimeout(() => {
      setPromptTimedOut(true);
    }, 60000);
    await persist({ interview_answers: answers });
    const { data, error } = await supabase.functions.invoke("ai-builder", {
      body: {
        action: "generate_system_prompt",
        clinic_id: clinicId,
        payload: {
          niche,
          niche_other: nicheOther,
          goal,
          goal_other: goalOther,
          answers,
          refinement: extraRefinement ?? "",
          previous_prompt: extraRefinement ? bundle?.system_prompt ?? "" : "",
        },
      },
    });
    clearPromptTimers();
    setPromptTimeoutWarning(false);
    setPromptTimedOut(false);
    setPromptLoading(false);
    if (error) {
      const parsed = parseBuilderError({ message: error.message });
      setPromptError(parsed);
      toast.error(parsed.title);
      return;
    }
    const result = data as { ok?: boolean } & GeneratedPromptBundle & Record<string, unknown>;
    if (!result?.ok) {
      const parsed = parseBuilderError(result);
      setPromptError(parsed);
      toast.error(parsed.title);
      return;
    }
    const next: GeneratedPromptBundle = {
      system_prompt: result.system_prompt,
      suggested_tools: result.suggested_tools ?? [],
      suggested_temperature: result.suggested_temperature ?? 0.4,
      suggested_top_k: result.suggested_top_k ?? 6,
      suggested_max_iterations: result.suggested_max_iterations ?? 6,
      rationale: result.rationale ?? "",
      evals: result.evals,
    };
    setBundle(next);
    setRefinement("");
    await persist({
      generated_prompt: next.system_prompt,
      settings: {
        suggested_tools: next.suggested_tools,
        suggested_temperature: next.suggested_temperature,
        suggested_top_k: next.suggested_top_k,
        suggested_max_iterations: next.suggested_max_iterations,
        rationale: next.rationale,
        evals: next.evals ?? null,
      },
    });
    if (next.evals && next.evals.context_clause_present === false) {
      toast.warning("Cláusula de contexto foi reinjetada automaticamente.");
    } else {
      toast.success("Prompt gerado.");
    }
  }

  // Limpa timers ao desmontar
  useEffect(() => () => clearPromptTimers(), []);

  // Handlers que invalidam prompt ao trocar nicho/objetivo
  function chooseNiche(nextId: string) {
    if (nextId === niche) return;
    setNiche(nextId);
    if (bundle || draft?.generated_prompt) {
      setBundle(null);
      void persist({
        niche: nextId,
        generated_prompt: null,
        settings: {},
      });
      toast.message("Nicho alterado. O prompt será regenerado no passo 5.");
    }
  }

  function chooseGoal(nextId: string) {
    if (nextId === goal) return;
    setGoal(nextId);
    if (bundle || draft?.generated_prompt) {
      setBundle(null);
      void persist({
        goal: nextId,
        generated_prompt: null,
        settings: {},
      });
      toast.message("Objetivo alterado. O prompt será regenerado no passo 5.");
    }
  }


  async function testConnection() {
    if (!clinicId) return;
    setTesting(true);
    setTestError(null);
    // Salva primeiro pra garantir que ai-builder use os valores mais recentes
    await persist({});
    const overrides =
      keySource === "builder"
        ? { clinic_id: clinicId }
        : {
            clinic_id: clinicId,
            provider,
            api_key: apiKey,
            base_url: baseUrl || null,
            model,
          };
    const { data, error } = await supabase.functions.invoke("ai-builder", {
      body: {
        action: "ping",
        ...overrides,
      },
    });
    setTesting(false);
    if (error) {
      const parsed = parseBuilderError({ message: error.message });
      setTestError(parsed);
      toast.error(parsed.title);
      return;
    }
    const result = data as { ok?: boolean; latency_ms?: number } & Record<string, unknown>;
    if (!result?.ok) {
      const parsed = parseBuilderError(result);
      setTestError(parsed);
      toast.error(parsed.title);
      return;
    }
    const now = new Date().toISOString();
    setVerifiedAt(now);
    await persist({ provider_verified_at: now });
    toast.success(`Conexão validada (${result.latency_ms ?? "—"} ms)`);
  }

  // Invalida verificação quando dados mudam (somente no modo "chave própria")
  useEffect(() => {
    if (keySource === "builder") return;
    if (verifiedAt) setVerifiedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, provider, model, baseUrl, keySource]);


  // Sugere nome do agente quando entramos no passo 5 sem nome definido
  useEffect(() => {
    if (step !== 5 || agentName.trim().length > 0) return;
    const goalLabel = GOALS.find((g) => g.id === goal)?.label.split(" ")[0] ?? "Agente";
    const nicheLabel =
      niche === "other"
        ? (nicheOther || "").trim()
        : NICHES.find((n) => n.id === niche)?.label ?? "";
    const suggestion = nicheLabel ? `${goalLabel} — ${nicheLabel}` : goalLabel;
    setAgentName(suggestion.slice(0, 80));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ---------- Criar agente ----------

  async function finishAndCreateAgent() {
    if (!clinicId || !userId) return;
    if (!bundle?.system_prompt) {
      toast.error("Gere o prompt antes de concluir.");
      return;
    }
    const name = agentName.trim();
    if (name.length < 2 || name.length > 80) {
      toast.error("Dê um nome ao agente (2-80 caracteres).");
      return;
    }
    const useBuilder = keySource === "builder";
    const effectiveModel = model || (useBuilder ? builderInfo?.model ?? "" : "");
    const hasKey = useBuilder ? !!builderInfo?.api_key_set : !!apiKey;
    if (!hasKey || !effectiveModel) {
      toast.error("Conexão com o provedor está incompleta.");
      return;
    }


    setCreating(true);
    try {
      // Salva o nome no rascunho antes de criar (sobrevive a falhas)
      await persist({
        settings: {
          ...((draft?.settings as Record<string, unknown>) ?? {}),
          suggested_tools: bundle.suggested_tools,
          suggested_temperature: bundle.suggested_temperature,
          suggested_top_k: bundle.suggested_top_k,
          suggested_max_iterations: bundle.suggested_max_iterations,
          rationale: bundle.rationale,
          evals: bundle.evals ?? null,
          agent_name: name,
        },
      });

      const nicheLabel =
        niche === "other"
          ? nicheOther.trim()
          : NICHES.find((n) => n.id === niche)?.label ?? "";
      const goalLabel = GOALS.find((g) => g.id === goal)?.label ?? "";
      const description = [goalLabel, nicheLabel].filter(Boolean).join(" · ");
      const tools = filterKnownTools(bundle.suggested_tools);

      // Criação via edge function: a "builder shared key" nunca trafega pelo client.
      const { data, error } = await supabase.functions.invoke("agent-create", {
        body: {
          name,
          description: description || null,
          role: goal || null,
          niche: niche || null,
          niche_other: nicheOther || null,
          key_source: useBuilder ? "builder" : "own",
          own_provider: useBuilder ? undefined : provider,
          own_api_key: useBuilder ? undefined : apiKey,
          own_base_url: useBuilder ? undefined : (baseUrl || null),
          own_model: useBuilder ? undefined : effectiveModel,
          system_prompt: bundle.system_prompt,
          temperature: bundle.suggested_temperature,
          max_iterations: bundle.suggested_max_iterations,
          rag_top_k: bundle.suggested_top_k,
          tools,
          verified_at: verifiedAt,
        },
      });

      if (error) throw error;
      const newId = (data as { id: string }).id;

      // Limpa o rascunho com retry (até 2 tentativas). Falha silenciosa — o agente já existe.
      let deleteAttempts = 0;
      while (deleteAttempts < 2) {
        const { error: deleteError } = await supabase
          .from("ai_agent_drafts")
          .delete()
          .eq("clinic_id", clinicId)
          .eq("user_id", userId);
        if (!deleteError) break;
        deleteAttempts++;
        if (deleteAttempts < 2) await new Promise((r) => setTimeout(r, 1000));
        else console.warn("[AgentWizard] draft cleanup failed:", deleteError.message);
      }

      // Em vez de redirecionar direto, abre modal de sucesso com opções
      setSuccessAgentId(newId);

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao criar agente";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  // ---------- Render ----------

  const providerInfo = useMemo(
    () => PROVIDERS.find((p) => p.id === provider)!,
    [provider]
  );

  if (hydrating || builderStatus === "checking") {
    return (
      <div className="grid min-h-[60vh] place-items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {builderStatus === "checking" && <span>Verificando configuração…</span>}
      </div>
    );
  }

  if (builderStatus === "missing") {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Configure o Construtor de Agentes primeiro</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Para criar agentes, o administrador da conta precisa configurar a chave de API do Construtor. Isso é feito uma única vez.
          </p>
          {canManage ? (
            <Button className="mt-5" onClick={() => nav("/ai/agents")}>Configurar agora</Button>
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">
              Entre em contato com o administrador da sua conta para fazer essa configuração.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-full overflow-auto bg-muted/30 px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold">Criar agente com assistente</h1>
            <p className="text-sm text-muted-foreground">
              O Construtor te guia. Você pode pausar e retomar a qualquer momento.
            </p>
          </div>

          <Stepper step={step} />

          <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
            {step === 1 && (
              <Step1
                niche={niche}
                setNiche={chooseNiche}
                nicheOther={nicheOther}
                setNicheOther={setNicheOther}
              />
            )}
            {step === 2 && (
              <Step2
                goal={goal}
                setGoal={chooseGoal}
                goalOther={goalOther}
                setGoalOther={setGoalOther}
              />
            )}

            {step === 3 && (
              <Step3
                keySource={keySource}
                setKeySource={(s) => {
                  setKeySource(s);
                  void persist({
                    settings: {
                      ...((draft?.settings as Record<string, unknown>) ?? {}),
                      key_source: s,
                    },
                  });
                  if (s === "builder") setTestError(null);
                }}
                builderAvailable={builderStatus === "ok" && !!builderInfo?.api_key_set}
                builderInfo={builderInfo}
                provider={provider}
                setProvider={setProvider}
                apiKey={apiKey}
                setApiKey={setApiKey}
                baseUrl={baseUrl}
                setBaseUrl={setBaseUrl}
                model={model}
                setModel={setModel}
                providerInfo={providerInfo}
                isVerified={isVerified}
                testing={testing}
                testError={testError}
                onTest={testConnection}
              />
            )}

            {step === 4 && (
              <Step4
                questions={questions}
                answers={answers}
                setAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
                loading={interviewLoading}
                error={interviewError}
                onReload={loadInterview}
                onSkipDefaults={skipAllWithDefaults}
              />
            )}
            {step === 5 && (
              <Step5
                bundle={bundle}
                setBundle={setBundle}
                loading={promptLoading}
                error={promptError}
                refinement={refinement}
                setRefinement={setRefinement}
                onRegenerate={() => generatePrompt()}
                onRefine={() => generatePrompt(refinement)}
                agentName={agentName}
                setAgentName={setAgentName}
                timeoutWarning={promptTimeoutWarning}
                timedOut={promptTimedOut}
              />
            )}

          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button variant="ghost" onClick={goPrev} disabled={saving || creating}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {step === 1 ? "Cancelar" : "Voltar"}
            </Button>
            <div className="text-xs text-muted-foreground">
              {creating ? "Criando agente…" : saving ? "Salvando…" : draft ? "Progresso salvo" : ""}
            </div>
            {step < 5 ? (
              <Button
                onClick={goNext}
                disabled={
                  saving ||
                  (step === 1 && !canNextFromStep1) ||
                  (step === 2 && !canNextFromStep2) ||
                  (step === 3 && !canNextFromStep3) ||
                  (step === 4 && !canNextFromStep4)
                }
              >
                Continuar
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                disabled={
                  !canFinish ||
                  saving ||
                  creating ||
                  agentName.trim().length < 2
                }
                onClick={finishAndCreateAgent}
              >
                {creating ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                Criar agente
              </Button>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Depois de criado, você pode adicionar base de conhecimento, rodar testes e ativar o agente na página dele.
          </p>
        </div>
      </div>
      <Dialog
        open={!!successAgentId}
        onOpenChange={(open) => {
          if (!open && successAgentId) {
            nav(`/ai/agents?agent=${successAgentId}`);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center">Agente criado!</DialogTitle>
            <DialogDescription className="text-center">
              Está inativo — não responde leads até você ativar. Recomendamos completar estes passos antes:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <button
              type="button"
              onClick={() => {
                if (!successAgentId) return;
                const id = successAgentId;
                setSuccessAgentId(null);
                nav(`/ai/agents?agent=${id}&section=kb`);
              }}
              className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-info/15 text-info">
                <FileText className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">1. Adicionar base de conhecimento</div>
                <div className="text-xs text-muted-foreground">Cole o site, FAQ ou docs para o agente saber o que dizer.</div>
              </div>
              <ArrowRight className="mt-2 h-4 w-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (!successAgentId) return;
                const id = successAgentId;
                setSuccessAgentId(null);
                nav(`/ai/agents?agent=${id}&section=test`);
              }}
              className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <FlaskConical className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">2. Rodar testes no Test Lab</div>
                <div className="text-xs text-muted-foreground">Veja o agente respondendo cenários simulados sem risco.</div>
              </div>
              <ArrowRight className="mt-2 h-4 w-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              disabled={activating}
              onClick={async () => {
                if (!successAgentId) return;
                setActivating(true);
                const { error } = await supabase
                  .from("ai_agents")
                  .update({ enabled: true, draft_mode: false })
                  .eq("id", successAgentId);
                setActivating(false);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                toast.success("Agente ativado.");
                const id = successAgentId;
                setSuccessAgentId(null);
                nav(`/ai/agents?agent=${id}`);
              }}
              className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5 disabled:opacity-60"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">3. Ativar agora (pular passos acima)</div>
                <div className="text-xs text-muted-foreground">O agente começa a responder leads reais imediatamente.</div>
              </div>
              <ArrowRight className="mt-2 h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              variant="ghost"
              size="sm"
              disabled={activating}
              onClick={() => {
                if (!successAgentId) return;
                const id = successAgentId;
                setSuccessAgentId(null);
                nav(`/ai/agents?agent=${id}`);
              }}
            >
              Ver agente sem fazer nada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}


// ---------- Sub-componentes ----------

function LoadingPanel({
  title,
  messages,
  footer,
}: {
  title: string;
  messages: string[];
  footer?: ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % messages.length), 5000);
    return () => window.clearInterval(id);
  }, [messages.length]);
  return (
    <div className="rounded-lg border bg-muted/30 p-5 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <Loader2 className="h-4 w-4 animate-spin" />
        {title}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-[loading-bar_1.6s_ease-in-out_infinite] rounded-full bg-primary/70" />
      </div>
      <p className="mt-3 min-h-[1.25rem] text-xs text-muted-foreground transition-opacity">
        {messages[idx]}
      </p>
      {footer && <div className="mt-3">{footer}</div>}
      <style>{`@keyframes loading-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Nicho" },
    { n: 2, label: "Objetivo" },
    { n: 3, label: "Conexão" },
    { n: 4, label: "Entrevista" },
    { n: 5, label: "Prompt" },
  ];
  return (
    <div className="flex items-center justify-center gap-2">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
              step > it.n
                ? "bg-primary text-primary-foreground"
                : step === it.n
                ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {step > it.n ? <Check className="h-3.5 w-3.5" /> : it.n}
          </div>
          <span
            className={`text-xs ${
              step >= it.n ? "font-medium" : "text-muted-foreground"
            }`}
          >
            {it.label}
          </span>
          {i < items.length - 1 && <div className="h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function WhyTooltip({ tip }: { tip: TooltipKey }) {
  const t = BUILDER_TOOLTIPS[tip];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Por que isso importa?"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <div className="font-medium">{t.title}</div>
        <div className="mt-1 text-muted-foreground">{t.body}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function Step1({
  niche,
  setNiche,
  nicheOther,
  setNicheOther,
}: {
  niche: string;
  setNiche: (v: string) => void;
  nicheOther: string;
  setNicheOther: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center font-semibold">
          Qual é o seu negócio?
          <WhyTooltip tip="niche" />
        </h2>
        <p className="text-xs text-muted-foreground">
          Escolha o que mais se aproxima. Isso adapta a linguagem e os exemplos do agente.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {NICHES.map((n) => {
          const active = niche === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setNiche(n.id)}
              className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                active
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "hover:border-foreground/30 hover:bg-accent/30"
              }`}
            >
              <div className="text-lg">{n.emoji}</div>
              <div className="mt-1 text-sm font-medium">{n.label}</div>
              <div className="text-[11px] text-muted-foreground">{n.example}</div>
            </button>
          );
        })}
      </div>

      {niche === "other" && (
        <div className="space-y-1.5">
          <Label>Descreva seu negócio</Label>
          <Input
            value={nicheOther}
            onChange={(e) => setNicheOther(e.target.value)}
            placeholder="Ex.: Distribuidora de equipamentos industriais"
          />
        </div>
      )}
    </div>
  );
}

function Step2({
  goal,
  setGoal,
  goalOther,
  setGoalOther,
}: {
  goal: string;
  setGoal: (v: string) => void;
  goalOther: string;
  setGoalOther: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center font-semibold">
          Qual é o objetivo deste agente?
          <WhyTooltip tip="goal" />
        </h2>
        <p className="text-xs text-muted-foreground">
          O Construtor monta o prompt e sugere ferramentas com base nesta escolha.
        </p>
      </div>

      <div className="grid gap-2">
        {GOALS.map((g) => {
          const active = goal === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGoal(g.id)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                active
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "hover:border-foreground/30 hover:bg-accent/30"
              }`}
            >
              <div
                className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input"
                }`}
              >
                {active && <Check className="h-3 w-3" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{g.label}</div>
                <div className="text-xs text-muted-foreground">{g.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {goal === "custom" && (
        <div className="space-y-1.5">
          <Label>Descreva o objetivo livremente</Label>
          <Input
            value={goalOther}
            onChange={(e) => setGoalOther(e.target.value)}
            placeholder="Ex.: Recuperar carrinho abandonado por WhatsApp"
          />
        </div>
      )}
    </div>
  );
}

interface ProviderMeta {
  id: Provider;
  label: string;
  defaultModel: string;
  placeholder: string;
  baseExample: string;
}

function Step3({
  keySource,
  setKeySource,
  builderAvailable,
  builderInfo,
  provider,
  setProvider,
  apiKey,
  setApiKey,
  baseUrl,
  setBaseUrl,
  model,
  setModel,
  providerInfo,
  isVerified,
  testing,
  testError,
  onTest,
}: {
  keySource: "builder" | "own";
  setKeySource: (s: "builder" | "own") => void;
  builderAvailable: boolean;
  builderInfo: { id: string; provider: string; model: string; base_url: string | null; api_key_set: boolean } | null;
  provider: Provider;
  setProvider: (p: Provider) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  providerInfo: ProviderMeta;
  isVerified: boolean;
  testing: boolean;
  testError: ProviderError | null;
  onTest: () => void;
}) {
  const [advanced, setAdvanced] = useState(!!baseUrl);
  const useBuilder = keySource === "builder";
  const builderProviderLabel =
    PROVIDERS.find((p) => p.id === builderInfo?.provider)?.label ?? builderInfo?.provider ?? "—";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center font-semibold">
          Conecte seu provedor de IA
          <WhyTooltip tip="api_key" />
        </h2>
        <p className="text-xs text-muted-foreground">
          {useBuilder
            ? "Você pode reaproveitar a chave do Construtor ou usar uma chave separada para este agente."
            : "Você usa sua própria chave. Validamos antes de prosseguir."}
        </p>
      </div>

      {/* Seletor de origem da chave */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={!builderAvailable}
          onClick={() => setKeySource("builder")}
          className={`rounded-lg border p-3 text-left text-xs transition ${
            useBuilder
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "hover:border-foreground/30"
          } ${!builderAvailable ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Usar a chave do Construtor
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {builderAvailable
              ? "Reaproveita o provedor e a chave já validados na clínica."
              : "Configure o Construtor primeiro para liberar esta opção."}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setKeySource("own")}
          className={`rounded-lg border p-3 text-left text-xs transition ${
            !useBuilder
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "hover:border-foreground/30"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <SettingsIcon className="h-3.5 w-3.5" />
            Usar uma chave própria
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Use um provedor/chave separados só para este agente.
          </p>
        </button>
      </div>

      {useBuilder ? (
        <>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
            <div className="mb-2 flex items-center gap-2">
              <Badge className="gap-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Já validada
              </Badge>
              <span className="text-muted-foreground">Construtor da clínica</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Provedor</p>
                <p className="font-medium">{builderProviderLabel}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Modelo (Construtor)</p>
                <p className="font-medium">{builderInfo?.model || "—"}</p>
              </div>
            </div>
          </div>

          {(() => {
            const builderProv = (builderInfo?.provider as Provider) || "openai";
            const opts = MODELS_BY_PROVIDER[builderProv] ?? [];
            const isCustom = !!model && !opts.some((o) => o.value === model);
            const selectValue = !model ? "__inherit__" : isCustom ? CUSTOM_MODEL : model;
            return (
              <div className="space-y-1.5">
                <Label className="flex items-center">
                  Modelo para este agente <WhyTooltip tip="model" />
                </Label>
                <Select
                  value={selectValue}
                  onValueChange={(v) => {
                    if (v === "__inherit__") setModel("");
                    else if (v === CUSTOM_MODEL) setModel(model || builderInfo?.model || "");
                    else setModel(v);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__inherit__">
                      Usar o mesmo do Construtor ({builderInfo?.model || "—"})
                    </SelectItem>
                    {opts.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}{o.hint ? ` — ${o.hint}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_MODEL}>Outro (digitar manualmente)…</SelectItem>
                  </SelectContent>
                </Select>
                {(isCustom || selectValue === CUSTOM_MODEL) && (
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Nome exato do modelo"
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  Modelos disponíveis para {PROVIDERS.find((p) => p.id === builderProv)?.label ?? builderProv}.
                </p>
              </div>
            );
          })()}
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="flex items-center">
              Provedor <WhyTooltip tip="provider" />
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROVIDERS.map((p) => {
                const active = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProvider(p.id);
                      setModel(p.defaultModel);
                    }}
                    className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                      active
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "hover:border-foreground/30"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center">
              Chave de API <WhyTooltip tip="api_key" />
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={providerInfo.placeholder}
              autoComplete="off"
            />
          </div>

          {(() => {
            const opts = MODELS_BY_PROVIDER[provider] ?? [];
            const isCustom = !!model && !opts.some((o) => o.value === model);
            const selectValue = isCustom ? CUSTOM_MODEL : (model || providerInfo.defaultModel);
            return (
              <div className="space-y-1.5">
                <Label className="flex items-center">
                  Modelo <WhyTooltip tip="model" />
                </Label>
                <Select
                  value={selectValue}
                  onValueChange={(v) => {
                    if (v === CUSTOM_MODEL) setModel(model || "");
                    else setModel(v);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {opts.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}{o.hint ? ` — ${o.hint}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_MODEL}>Outro (digitar manualmente)…</SelectItem>
                  </SelectContent>
                </Select>
                {(isCustom || selectValue === CUSTOM_MODEL) && (
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={providerInfo.defaultModel}
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  Sugestão: <code>{providerInfo.defaultModel}</code>
                </p>
              </div>
            );
          })()}

          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={`h-3 w-3 transition ${advanced ? "rotate-180" : ""}`}
            />
            Avançado
          </button>
          {advanced && (
            <div className="space-y-1.5">
              <Label className="flex items-center">
                Base URL (opcional) <WhyTooltip tip="base_url" />
              </Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={providerInfo.baseExample}
              />
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isVerified ? (
                  <Badge className="gap-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Conexão validada
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Não testado
                  </Badge>
                )}
                <WhyTooltip tip="test_connection" />
              </div>
              <Button
                size="sm"
                variant={isVerified ? "outline" : "default"}
                onClick={onTest}
                disabled={testing || !apiKey || !model}
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Testando…
                  </>
                ) : isVerified ? (
                  "Testar de novo"
                ) : (
                  "Testar conexão"
                )}
              </Button>
            </div>
            {testError && <ProviderErrorBanner error={testError} className="text-xs" />}
            {!testError && !isVerified && (
              <p className="text-[11px] text-muted-foreground">
                Testar a conexão é obrigatório antes de avançar.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}


// ---------- Step 4 — Entrevista ----------

function KindBadge({ kind }: { kind: InterviewQuestion["kind"] }) {
  const map: Record<InterviewQuestion["kind"], { label: string; cls: string }> = {
    dominant_offer: { label: "Oferta principal", cls: "bg-primary/15 text-primary" },
    tone: { label: "Tom", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
    taboo: { label: "Tabu", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
    qualification: { label: "Qualificação", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    escalation: { label: "Escalação", cls: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
    context: { label: "Contexto", cls: "bg-muted text-muted-foreground" },
    custom: { label: "Customizado", cls: "bg-muted text-muted-foreground" },
  };
  const meta = map[kind] ?? map.custom;
  return <Badge variant="secondary" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>;
}

function Step4({
  questions,
  answers,
  setAnswer,
  loading,
  error,
  onReload,
  onSkipDefaults,
}: {
  questions: InterviewQuestion[];
  answers: Record<string, string>;
  setAnswer: (id: string, value: string) => void;
  loading: boolean;
  error: ProviderError | null;
  onReload: () => void;
  onSkipDefaults: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Conte um pouco sobre o seu negócio</h2>
        <p className="text-xs text-muted-foreground">
          Perguntas geradas pelo Construtor. Respostas curtas servem — você pode pular e usar padrões.
        </p>
      </div>

      {loading && (
        <LoadingPanel
          title="Preparando perguntas personalizadas para seu negócio…"
          messages={[
            "Lendo seu nicho e objetivo…",
            "Selecionando perguntas relevantes…",
            "Adaptando ao seu segmento…",
            "Quase pronto…",
          ]}
        />
      )}


      {error && (
        <div className="space-y-2">
          <ProviderErrorBanner error={error} className="text-xs" />
          <Button size="sm" variant="outline" onClick={onReload}>Tentar de novo</Button>
        </div>
      )}

      {!loading && !error && questions.length === 0 && (
        <Button variant="outline" onClick={onReload} className="w-full">
          Gerar perguntas
        </Button>
      )}

      {questions.length > 0 && (
        <>
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">
                    {q.label}
                    {q.required && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  <KindBadge kind={q.kind} />
                </div>
                <Input
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder ?? q.hint ?? "Resposta curta"}
                />
                {q.hint && <p className="text-[11px] text-muted-foreground">{q.hint}</p>}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <button
              type="button"
              onClick={onSkipDefaults}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Pular tudo com padrões
            </button>
            <button
              type="button"
              onClick={onReload}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Gerar perguntas de novo
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Step 5 — Prompt gerado ----------

function Step5({
  bundle,
  setBundle,
  loading,
  error,
  refinement,
  setRefinement,
  onRegenerate,
  onRefine,
  agentName,
  setAgentName,
  timeoutWarning,
  timedOut,
}: {
  bundle: GeneratedPromptBundle | null;
  setBundle: React.Dispatch<React.SetStateAction<GeneratedPromptBundle | null>>;
  loading: boolean;
  error: ProviderError | null;
  refinement: string;
  setRefinement: (v: string) => void;
  onRegenerate: () => void;
  onRefine: () => void;
  agentName: string;
  setAgentName: (v: string) => void;
  timeoutWarning: boolean;
  timedOut: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Prompt do agente</h2>
        <p className="text-xs text-muted-foreground">
          Gerado a partir das suas respostas. Você pode refinar com uma instrução em linguagem natural.
        </p>
      </div>

      {loading && !timedOut && (
        <LoadingPanel
          title="Gerando seu prompt personalizado…"
          messages={[
            "Analisando suas respostas…",
            "Estruturando o prompt por seções…",
            "Ajustando tom e objetivo…",
            "Quase pronto…",
          ]}
          footer={
            <p className="text-[11px] text-muted-foreground">
              Isso pode levar até 30 segundos. Não feche esta aba.
              {timeoutWarning && (
                <span className="ml-1 text-amber-600 dark:text-amber-400">
                  Está demorando mais que o normal — aguarde um pouco mais.
                </span>
              )}
            </p>
          }
        />
      )}

      {timedOut && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não conseguimos gerar o prompt agora</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>Verifique sua conexão e tente novamente.</span>
            <Button size="sm" variant="outline" className="self-start" onClick={onRegenerate}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}


      {error && (
        <div className="space-y-2">
          <ProviderErrorBanner error={error} className="text-xs" />
          <Button size="sm" variant="outline" onClick={onRegenerate}>Tentar de novo</Button>
        </div>
      )}

      {bundle && !loading && (
        <>
          {bundle.evals?.context_clause_present === false && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
              <span>
                A cláusula de contexto foi reinjetada automaticamente — o Construtor não a incluiu.
              </span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">System prompt</Label>
              <span className="text-[10px] text-muted-foreground">Edição livre</span>
            </div>
            <textarea
              value={bundle.system_prompt}
              onChange={(e) => setBundle((b) => (b ? { ...b, system_prompt: e.target.value } : b))}
              className="mt-1 h-64 w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs"
            />
          </div>

          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-md border bg-muted/30 p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Temperature</div>
              <div className="font-medium">{bundle.suggested_temperature}</div>
            </div>
            <div className="rounded-md border bg-muted/30 p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Top-K</div>
              <div className="font-medium">{bundle.suggested_top_k}</div>
            </div>
            <div className="rounded-md border bg-muted/30 p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Max iter.</div>
              <div className="font-medium">{bundle.suggested_max_iterations}</div>
            </div>
          </div>

          {bundle.suggested_tools.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Ferramentas sugeridas</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {bundle.suggested_tools.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {bundle.rationale && (
            <p className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Por que assim: </span>
              {bundle.rationale}
            </p>
          )}

          <div className="space-y-1.5 border-t pt-3">
            <Label className="text-xs">Refinar com uma instrução</Label>
            <Input
              value={refinement}
              onChange={(e) => setRefinement(e.target.value)}
              placeholder='Ex.: "Mais formal", "Pergunte a cidade antes de oferecer horários"'
            />
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={onRegenerate} disabled={loading}>
                Gerar do zero
              </Button>
              <Button size="sm" onClick={onRefine} disabled={loading || refinement.trim().length < 3}>
                Aplicar refinamento
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 border-t pt-3">
            <Label className="text-xs">Nome do agente</Label>
            <Input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value.slice(0, 80))}
              placeholder="Ex.: SDR — Clínica do Dr. Ivan"
              maxLength={80}
            />
            <p className="text-[11px] text-muted-foreground">
              Aparece na lista de agentes. Você pode renomear depois.
            </p>
          </div>
        </>
      )}

      {!bundle && !loading && !error && !timedOut && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm font-medium">Nenhum prompt gerado ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique em "Gerar prompt" para começar.
          </p>
          <Button className="mt-4" onClick={onRegenerate}>
            <Sparkles className="mr-1 h-4 w-4" />
            Gerar prompt
          </Button>
        </div>
      )}

    </div>
  );
}
