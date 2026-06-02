import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  api_key: string | null;
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

  const clinicId = membership?.clinic_id ?? null;
  const userId = user?.id ?? null;
  const canManage =
    membership?.role === "owner" || membership?.role === "admin";

  // Hidrata draft
  useEffect(() => {
    document.title = "Construtor de Agentes — MK CRM";
  }, []);

  useEffect(() => {
    if (loading || !clinicId || !userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ai_agent_drafts")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const d = data as DraftRow;
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
  }, [loading, clinicId, userId]);

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
        .select()
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
  const canNextFromStep3 = !!apiKey && !!model && isVerified;

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

  async function generatePrompt(extraRefinement?: string) {
    if (!clinicId) return;
    setPromptLoading(true);
    setPromptError(null);
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

  async function testConnection() {
    if (!clinicId) return;
    setTesting(true);
    setTestError(null);
    // Salva primeiro pra garantir que ai-builder use os valores mais recentes
    await persist({});
    const { data, error } = await supabase.functions.invoke("ai-builder", {
      body: {
        action: "ping",
        clinic_id: clinicId,
        // overrides opcionais — ai-builder pode preferir usar do Builder do clinic;
        // o backend aceita override durante o wizard
        provider,
        api_key: apiKey,
        base_url: baseUrl || null,
        model,
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

  // Invalida verificação quando dados mudam
  useEffect(() => {
    if (verifiedAt) setVerifiedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, provider, model, baseUrl]);

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
    if (!apiKey || !model) {
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

      const { data, error } = await supabase
        .from("ai_agents")
        .insert({
          clinic_id: clinicId,
          name,
          description: description || null,
          role: goal || null,
          niche: niche || null,
          niche_other: nicheOther || null,
          provider,
          api_key: apiKey,
          base_url: baseUrl || null,
          model,
          system_prompt: bundle.system_prompt,
          temperature: bundle.suggested_temperature,
          max_iterations: bundle.suggested_max_iterations,
          rag_top_k: bundle.suggested_top_k,
          tools,
          enabled: false,
          draft_mode: true,
          builder_verified_at: verifiedAt,
        } as never)
        .select("id")
        .single();

      if (error) throw error;
      const newId = (data as { id: string }).id;

      // Limpa o rascunho — agente já existe
      await supabase
        .from("ai_agent_drafts")
        .delete()
        .eq("clinic_id", clinicId)
        .eq("user_id", userId);

      toast.success("Agente criado.");
      nav(`/ai/agents/${newId}`);
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

  if (hydrating) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
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
                setNiche={setNiche}
                nicheOther={nicheOther}
                setNicheOther={setNicheOther}
              />
            )}
            {step === 2 && (
              <Step2
                goal={goal}
                setGoal={setGoal}
                goalOther={goalOther}
                setGoalOther={setGoalOther}
              />
            )}
            {step === 3 && (
              <Step3
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
                loading={promptLoading}
                error={promptError}
                refinement={refinement}
                setRefinement={setRefinement}
                onRegenerate={() => generatePrompt()}
                onRefine={() => generatePrompt(refinement)}
                agentName={agentName}
                setAgentName={setAgentName}
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
    </TooltipProvider>
  );
}

// ---------- Sub-componentes ----------

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center font-semibold">
          Conecte seu provedor de IA
          <WhyTooltip tip="api_key" />
        </h2>
        <p className="text-xs text-muted-foreground">
          Você usa sua própria chave. Validamos antes de prosseguir.
        </p>
      </div>

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
                  if (!model) setModel(p.defaultModel);
                  else setModel(p.defaultModel);
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

      <div className="space-y-1.5">
        <Label className="flex items-center">
          Modelo <WhyTooltip tip="model" />
        </Label>
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={providerInfo.defaultModel}
        />
        <p className="text-[11px] text-muted-foreground">
          Sugestão para começar: <code>{providerInfo.defaultModel}</code>
        </p>
      </div>

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
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando perguntas adaptadas…
        </div>
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
  loading,
  error,
  refinement,
  setRefinement,
  onRegenerate,
  onRefine,
  agentName,
  setAgentName,
}: {
  bundle: GeneratedPromptBundle | null;
  loading: boolean;
  error: ProviderError | null;
  refinement: string;
  setRefinement: (v: string) => void;
  onRegenerate: () => void;
  onRefine: () => void;
  agentName: string;
  setAgentName: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Prompt do agente</h2>
        <p className="text-xs text-muted-foreground">
          Gerado a partir das suas respostas. Você pode refinar com uma instrução em linguagem natural.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando prompt…
        </div>
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
            <Label className="text-xs text-muted-foreground">System prompt</Label>
            <textarea
              readOnly
              value={bundle.system_prompt}
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

      {!bundle && !loading && !error && (
        <Button variant="outline" onClick={onRegenerate} className="w-full">
          Gerar prompt
        </Button>
      )}
    </div>
  );
}
