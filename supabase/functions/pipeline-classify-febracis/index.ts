// Tombstone. A edge original (classificador de pipeline Febracis) foi removida
// em 2026-07-10. O delete_edge_functions da Cloud falhou repetidas vezes, então
// mantemos este stub apenas para responder 410 Gone caso algo ainda tente
// invocar a função. Não há cron, trigger ou chamada interna apontando para cá
// (verificado em cron.job e pg_proc — 0 hits). Ver docs/_audit/FEBRACIS_CLEANUP.md.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return new Response(
    JSON.stringify({
      error: 'gone',
      message: 'pipeline-classify-febracis foi descontinuada. Ver docs/_audit/FEBRACIS_CLEANUP.md.',
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
