// Supabase Auth "Send Email Hook" → renderiza email em pt-BR com marca MK CRM
// e envia via Resend (connector gateway). Requer secrets:
//   - RESEND_API_KEY_1            (do connector Resend)
//   - LOVABLE_API_KEY             (auto)
//   - SEND_EMAIL_HOOK_SECRET      (gerado pelo Supabase ao ativar o hook;
//                                  formato: "v1,whsec_<base64>")
// Configurado em supabase/config.toml com verify_jwt = false — o Supabase
// chama esta function sem JWT, autenticando via assinatura standardwebhooks.

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const FROM = "MK CRM <contato@mkart.com.br>";
const APP_URL = "https://crm.mkart.com.br";
const RESEND_URL = "https://connector-gateway.lovable.dev/resend/emails";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

type EmailAction =
  | "signup"
  | "login"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email_change_new"
  | "email_change_current"
  | "reauthentication";

interface HookPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailAction;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function buildConfirmUrl(p: HookPayload): string {
  const { token_hash, email_action_type, redirect_to, site_url } = p.email_data;
  // Mantém o tipo nativo do Supabase para o link verificar e em seguida
  // redirecionar pro redirect_to (que já forçamos como APP_URL/reset-password).
  const base = site_url?.replace(/\/$/, "") || "";
  const url = new URL(`${base}/auth/v1/verify`);
  url.searchParams.set("token", token_hash);
  url.searchParams.set("type", email_action_type);
  url.searchParams.set("redirect_to", redirect_to || `${APP_URL}/`);
  return url.toString();
}

interface RenderedEmail {
  subject: string;
  html: string;
}

function shell(title: string, bodyHtml: string): string {
  // Email-safe HTML inline com paleta do MK CRM (verde primary 142 71% 45%).
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f1e2e;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e9f0;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #eef1f5;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#1fbf5c;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;color:#ffffff;font-weight:700;font-size:16px;line-height:32px;">MK</td>
                    <td style="padding-left:10px;font-weight:600;font-size:16px;color:#0f1e2e;">MK CRM</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;border-top:1px solid #eef1f5;font-size:12px;color:#6b7785;">
                Você está recebendo este email porque há uma conta no MK CRM associada a este endereço.
                Se não foi você, pode ignorar com segurança.
              </td>
            </tr>
          </table>
          <div style="font-size:11px;color:#9aa4b1;margin-top:14px;">© MK CRM · ${APP_URL.replace("https://", "")}</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:#1fbf5c;border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>
    </td></tr>
  </table>`;
}

function fallbackLink(href: string): string {
  return `<p style="font-size:12px;color:#6b7785;line-height:1.5;margin:0;">
    Se o botão não funcionar, copie e cole este link no seu navegador:<br/>
    <a href="${href}" style="color:#1fbf5c;word-break:break-all;">${href}</a>
  </p>`;
}

function render(p: HookPayload): RenderedEmail {
  const action = p.email_data.email_action_type;
  const url = buildConfirmUrl(p);
  const token = p.email_data.token;

  switch (action) {
    case "recovery": {
      const body = `
        <h1 style="margin:0 0 12px;font-size:20px;color:#0f1e2e;">Redefinir sua senha</h1>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#3b4a5c;">
          Recebemos um pedido para redefinir a senha da sua conta no MK CRM.
          Clique no botão abaixo para escolher uma nova senha. O link expira em 1 hora.
        </p>
        ${btn(url, "Redefinir senha")}
        ${fallbackLink(url)}`;
      return { subject: "Redefinir sua senha — MK CRM", html: shell("Redefinir senha", body) };
    }
    case "signup": {
      const body = `
        <h1 style="margin:0 0 12px;font-size:20px;color:#0f1e2e;">Confirme seu email</h1>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#3b4a5c;">
          Bem-vindo ao MK CRM! Confirme seu endereço de email para ativar sua conta.
        </p>
        ${btn(url, "Confirmar email")}
        ${fallbackLink(url)}`;
      return { subject: "Confirme seu email — MK CRM", html: shell("Confirmar email", body) };
    }
    case "magiclink": {
      const body = `
        <h1 style="margin:0 0 12px;font-size:20px;color:#0f1e2e;">Seu link de acesso</h1>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#3b4a5c;">
          Clique abaixo para entrar no MK CRM sem digitar senha. O link expira em 1 hora.
        </p>
        ${btn(url, "Entrar no MK CRM")}
        ${fallbackLink(url)}`;
      return { subject: "Seu link de acesso — MK CRM", html: shell("Link de acesso", body) };
    }
    case "invite": {
      const body = `
        <h1 style="margin:0 0 12px;font-size:20px;color:#0f1e2e;">Você foi convidado</h1>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#3b4a5c;">
          Você recebeu um convite para acessar o MK CRM. Aceite o convite para criar sua senha e começar a usar.
        </p>
        ${btn(url, "Aceitar convite")}
        ${fallbackLink(url)}`;
      return { subject: "Convite para o MK CRM", html: shell("Convite", body) };
    }
    case "email_change":
    case "email_change_new":
    case "email_change_current": {
      const body = `
        <h1 style="margin:0 0 12px;font-size:20px;color:#0f1e2e;">Confirme a alteração de email</h1>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#3b4a5c;">
          Recebemos um pedido para alterar o email da sua conta no MK CRM. Confirme abaixo para concluir.
        </p>
        ${btn(url, "Confirmar alteração")}
        ${fallbackLink(url)}`;
      return { subject: "Confirme a alteração de email — MK CRM", html: shell("Alteração de email", body) };
    }
    case "reauthentication": {
      const body = `
        <h1 style="margin:0 0 12px;font-size:20px;color:#0f1e2e;">Código de verificação</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#3b4a5c;">
          Use o código abaixo para confirmar sua identidade no MK CRM. Ele expira em 5 minutos.
        </p>
        <div style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f5f7fa;border-radius:8px;padding:16px;text-align:center;color:#0f1e2e;">${token}</div>`;
      return { subject: "Código de verificação — MK CRM", html: shell("Código", body) };
    }
    default: {
      const body = `
        <h1 style="margin:0 0 12px;font-size:20px;color:#0f1e2e;">Confirmação necessária</h1>
        ${btn(url, "Continuar")}
        ${fallbackLink(url)}`;
      return { subject: "Confirmação — MK CRM", html: shell("Confirmação", body) };
    }
  }
}

async function sendViaResend(to: string, subject: string, html: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY_1");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY_1 ausente — conecte o Resend");

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend falhou [${res.status}]: ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!HOOK_SECRET) {
    console.error("SEND_EMAIL_HOOK_SECRET ausente");
    return new Response(JSON.stringify({ error: "hook_secret_missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = await req.text();
  const headers = Object.fromEntries(req.headers);

  let payload: HookPayload;
  try {
    // standardwebhooks espera o secret SEM o prefixo "v1,"
    const secret = HOOK_SECRET.startsWith("v1,") ? HOOK_SECRET.substring(3) : HOOK_SECRET;
    const wh = new Webhook(secret);
    payload = wh.verify(raw, headers) as HookPayload;
  } catch (err) {
    console.error("Assinatura inválida:", err);
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { subject, html } = render(payload);
    await sendViaResend(payload.user.email, subject, html);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Falha no envio:", err);
    // Retorna 200 com erro pra Supabase não bloquear o fluxo de auth.
    // O usuário vê toast neutro; logs ficam aqui pra debug.
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
