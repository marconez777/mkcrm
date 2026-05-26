#!/usr/bin/env bash
# Exemplos de uso da API direta (external-lead-capture) — server-to-server.
# Requer token privado (NUNCA expor em browser).

set -euo pipefail

ENDPOINT="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/external-lead-capture"
TOKEN="${MK_TOKEN:?defina MK_TOKEN no ambiente}"
CLINIC_ID="${MK_CLINIC_ID:?defina MK_CLINIC_ID no ambiente}"

# -----------------------------------------------------------
# 1) Lead mínimo (só email)
# -----------------------------------------------------------
echo "==> Lead mínimo"
curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-capture-token: $TOKEN" \
  -d "{
    \"clinic_id\": \"$CLINIC_ID\",
    \"email\": \"teste-curl@example.com\"
  }"
echo

# -----------------------------------------------------------
# 2) Lead completo, vindo de uma landing
# -----------------------------------------------------------
echo "==> Lead completo"
curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-capture-token: $TOKEN" \
  -d "{
    \"clinic_id\": \"$CLINIC_ID\",
    \"name\": \"Ana Silva\",
    \"email\": \"ana@example.com\",
    \"phone\": \"+5511999998888\",
    \"source_page\": \"https://meusite.com/landing-phq9\",
    \"form_kind\": \"quiz_phq9\",
    \"extra\": {
      \"score\": 18,
      \"severity\": \"moderate\",
      \"answers\": [3,2,1,2,3,0,1,2,3]
    }
  }"
echo

# -----------------------------------------------------------
# 3) Lead com visitor_id (faz stitching com tracking)
# -----------------------------------------------------------
echo "==> Lead com visitor_id (vindo de um chatbot que conhece o cookie)"
curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-capture-token: $TOKEN" \
  -d "{
    \"clinic_id\": \"$CLINIC_ID\",
    \"visitor_id\": \"v_abc123def456\",
    \"email\": \"chatbot-user@example.com\",
    \"source_page\": \"https://meusite.com/chat\",
    \"form_kind\": \"chatbot\"
  }"
echo

# -----------------------------------------------------------
# 4) Idempotência: chamar 2x retorna o mesmo lead_id
# -----------------------------------------------------------
echo "==> Idempotência (rode 2x, mesmo email/phone = mesmo lead)"
curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-capture-token: $TOKEN" \
  -d "{
    \"clinic_id\": \"$CLINIC_ID\",
    \"email\": \"idempotente@example.com\",
    \"phone\": \"+5511988887777\"
  }"
echo
