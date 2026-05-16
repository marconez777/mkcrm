## Ajustes no dialog "Nova automação" (`EmailAutomations.tsx`)

Dois gaps no formulário de passos:

1. **Atraso em minutos** — confuso. Trocar para **dias + horas** (dois inputs lado a lado), convertidos para `delay_minutes` no salvamento.
2. **Sem seletor de segmento** — adicionar campo "Segmento" (opcional) no nível da automação, lendo de `email_segments` da clínica.

---

### Mudanças

**Schema do step (sem migration)**
- Manter `delay_minutes` no banco (compatível com presets e backend existente).
- UI converte: `delay_minutes = dias * 1440 + horas * 60`.
- Ao carregar para edição: derivar `days = floor(delay_minutes / 1440)` e `hours = floor((delay_minutes % 1440) / 60)`.

**Novo campo: Segmento**
- Adicionar `segment_id: string | null` ao `trigger_config` (não precisa migration — já é jsonb).
- Carregar lista via `supabase.from("email_segments").select("id,name").eq("clinic_id", clinicId).order("name")`.
- Select com opção "Todos os leads (sem filtro)" como default.
- Documentar: backend de execução de automação deve filtrar leads pelo segmento quando `trigger_config.segment_id` estiver presente (fora do escopo desta UI — só persistir).

**Layout do dialog atualizado**

```text
Nome
Descrição
Disparo            [select]
Segmento (opcional) [select: Todos / segmentos da clínica]
─────────────────────────────────
Passos                    [+ Passo]
  ┌ Passo 1 ─────────────────────┐
  │ Template [select]            │
  │ Atraso:  [dias] d  [horas] h │
  └──────────────────────────────┘
─────────────────────────────────
[ ] Ativar automação
                  [Cancelar] [Salvar]
```

**Validações**
- dias ≥ 0, horas 0–23
- Se ambos 0 no passo 1 → ok (envio imediato)
- Segmento opcional

---

### Arquivos tocados

- `src/pages/email/EmailAutomations.tsx` — único arquivo. Adicionar state `segments`, carregar na `load()`, novo Select de segmento no dialog, substituir input de minutos por dias+horas com helpers de conversão.

Nada de backend, migration ou outros arquivos.
