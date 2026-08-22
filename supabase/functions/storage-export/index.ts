// TEMPORÁRIA — assina URLs de download do storage para a cópia de backup/migração.
//
// Existe porque o painel do Lovable Cloud não expõe a service_role key e a tela
// de Storage só baixa arquivo por arquivo (são 5.449). A chave que esta função
// usa é a que o próprio runtime injeta: nunca sai do servidor, nunca aparece no
// repositório nem no chat.
//
// APAGAR depois que a cópia estiver conferida, junto com o secret
// STORAGE_EXPORT_TOKEN. Ver docs/roadmap/MIGRACAO_SUPABASE_PLANO.md §R0.
//
// Protocolo: POST { bucket, paths: string[], expiresIn?: number }
//            header x-export-token: <STORAGE_EXPORT_TOKEN>
//            -> { urls: [{ path, signedUrl, error }] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MAX_PATHS = 100;
const MAX_EXPIRES = 60 * 60 * 6; // 6h

// Comparação de tempo constante: um `===` vaza o tamanho do prefixo correto
// por diferença de tempo, e este endpoint é público (verify_jwt = false).
function tokenMatches(got: string | null, expected: string): boolean {
  if (!got || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("STORAGE_EXPORT_TOKEN") ?? "";

  // Sem token configurado a função fica inerte, não aberta.
  if (expected.length < 24) {
    console.error("STORAGE_EXPORT_TOKEN ausente ou curto demais");
    return new Response("not found", { status: 404 });
  }
  if (!tokenMatches(req.headers.get("x-export-token"), expected)) {
    return new Response("not found", { status: 404 });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let body: { bucket?: string; paths?: string[]; expiresIn?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "json inválido" }, { status: 400 });
  }

  const bucket = body.bucket;
  const paths = body.paths;
  if (!bucket || !Array.isArray(paths) || paths.length === 0) {
    return Response.json({ error: "informe bucket e paths[]" }, { status: 400 });
  }
  if (paths.length > MAX_PATHS) {
    return Response.json({ error: `no máximo ${MAX_PATHS} paths por chamada` }, { status: 400 });
  }
  const expiresIn = Math.min(body.expiresIn ?? 3600, MAX_EXPIRES);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await admin.storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error) {
    console.error("createSignedUrls", bucket, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    urls: (data ?? []).map((d) => ({
      path: d.path,
      signedUrl: d.signedUrl ?? null,
      error: d.error ?? null,
    })),
  });
});
