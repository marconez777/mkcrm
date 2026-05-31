import { useState } from "react";
import { Mail, MessageCircle, MapPin, Phone, Send, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Informe seu nome" })
    .max(100, { message: "Nome muito longo" }),
  email: z
    .string()
    .trim()
    .email({ message: "E-mail inválido" })
    .max(255, { message: "E-mail muito longo" }),
  clinic: z.string().trim().max(120, { message: "Texto muito longo" }).optional(),
  message: z
    .string()
    .trim()
    .min(10, { message: "Conte um pouco mais (mín. 10 caracteres)" })
    .max(1000, { message: "Mensagem muito longa" }),
});

type FormErrors = Partial<Record<keyof z.infer<typeof contactSchema>, string>>;

const CHANNELS = [
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "+55 (11) 99999-9999",
    href: "https://wa.me/5511999999999",
  },
  {
    icon: Mail,
    label: "E-mail",
    value: "contato@mkcrm.com.br",
    href: "mailto:contato@mkcrm.com.br",
  },
  {
    icon: Phone,
    label: "Comercial",
    value: "+55 (11) 4000-0000",
    href: "tel:+551140000000",
  },
  {
    icon: MapPin,
    label: "Sede",
    value: "São Paulo · SP · Brasil",
    href: "#",
  },
];

export default function Contact() {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      clinic: (form.elements.namedItem("clinic") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    const result = contactSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((i) => {
        const key = i.path[0] as keyof FormErrors;
        if (key && !fieldErrors[key]) fieldErrors[key] = i.message;
      });
      setErrors(fieldErrors);
      toast.error("Confira os campos destacados");
      return;
    }

    setErrors({});
    setSubmitting(true);
    // Placeholder: integração de envio entra em etapa futura
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    toast.success("Recebido! Entraremos em contato em breve.");
    form.reset();
  }

  return (
    <section
      id="contato"
      aria-label="Fale com a gente"
      className="relative overflow-hidden border-t border-white/5 bg-site-bg py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-15%] top-1/4 h-[500px] w-[500px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--site-accent) / 0.45), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] bottom-0 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--site-primary) / 0.3), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          {/* Coluna info */}
          <div>
            <span className="site-font-body inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[15px] text-site-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-site-primary" />
              Fale com a gente
            </span>
            <h2 className="site-font-display mt-5 text-[44px] leading-[0.95] tracking-tight sm:text-[56px]">
              Vamos colocar sua
              <br />
              clínica pra <span className="text-site-primary">vender</span>?
            </h2>
            <p className="site-font-body mt-5 max-w-md text-[17px] leading-relaxed text-site-muted">
              Conte sobre sua operação. Em até 1 dia útil um especialista
              responde com um plano de implantação sob medida.
            </p>

            <ul className="mt-10 flex flex-col gap-3">
              {CHANNELS.map(({ icon: Icon, label, value, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-site-surface p-4 transition-all hover:border-site-primary/50"
                  >
                    <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white/10 bg-site-bg text-site-primary transition-colors group-hover:border-site-primary/60">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="site-font-body text-[12px] uppercase tracking-wider text-site-muted">
                        {label}
                      </p>
                      <p className="site-font-display text-[15px] leading-tight text-site-text">
                        {value}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna form */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-3xl border border-white/10 bg-site-surface p-6 sm:p-8"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="name"
                label="Nome completo"
                placeholder="Seu nome"
                error={errors.name}
                required
              />
              <Field
                id="email"
                type="email"
                label="E-mail"
                placeholder="voce@clinica.com.br"
                error={errors.email}
                required
              />
            </div>
            <div className="mt-5">
              <Field
                id="clinic"
                label="Clínica / empresa"
                placeholder="Opcional"
                error={errors.clinic}
              />
            </div>
            <div className="mt-5">
              <label
                htmlFor="message"
                className="site-font-body block text-[13px] text-site-muted"
              >
                Como podemos ajudar?
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                maxLength={1000}
                placeholder="Conte sobre seu time, volume de leads e o que está travando hoje."
                className="site-font-body mt-2 w-full rounded-2xl border border-white/10 bg-site-bg px-4 py-3 text-[15px] text-site-text placeholder:text-site-muted/60 outline-none transition-colors focus:border-site-primary/60"
              />
              {errors.message && (
                <p className="site-font-body mt-2 text-[12px] text-red-400">
                  {errors.message}
                </p>
              )}
            </div>

            <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="site-font-body text-[12px] text-site-muted">
                Ao enviar você concorda com nossa{" "}
                <a href="#" className="text-site-text hover:text-site-primary">
                  política de privacidade
                </a>
                .
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-site-primary px-6 site-font-body text-[14px] text-site-bg transition-all hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Enviando..." : "Enviar mensagem"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
  error,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="site-font-body block text-[13px] text-site-muted"
      >
        {label}
        {required && <span className="text-site-primary"> *</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        maxLength={255}
        className="site-font-body mt-2 w-full rounded-2xl border border-white/10 bg-site-bg px-4 py-3 text-[15px] text-site-text placeholder:text-site-muted/60 outline-none transition-colors focus:border-site-primary/60"
      />
      {error && (
        <p className="site-font-body mt-2 text-[12px] text-red-400">{error}</p>
      )}
    </div>
  );
}
