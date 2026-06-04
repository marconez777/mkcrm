# Configurar e verificar domínio de email

## Quando usar
Antes de enviar qualquer campanha. Sem domínio verificado os emails vão para spam ou nem saem.

## Pré-requisitos
- Acesso ao painel DNS do domínio (Registro.br, Cloudflare, GoDaddy, etc.).
- Domínio próprio (não dá para usar gmail.com, hotmail.com, etc.).

## Passo a passo
1. Vá em **Email → Configurações de domínio** (`/settings/email`).
2. Clique em **Adicionar domínio**.
3. Digite o domínio (ex.: `mkt.suaclinica.com.br`).
4. O sistema gera registros DNS: **SPF**, **DKIM**, **MX** (se aplicável).
5. Copie cada registro e cole no painel DNS do seu provedor.
6. Volte à tela e clique em **Verificar**. A propagação leva de 5min a algumas horas.
7. Quando os 3 registros ficarem **verdes**, o domínio está pronto.

## Como saber que deu certo
- Status do domínio: **Verificado** (badge verde).
- Já aparece como remetente disponível em **Email → Campanhas**.

## Se algo der errado
- Registros vermelhos após várias horas → `troubleshooting/email.md` (seção "Domínio não verifica").
- Erro de SPF → verifique se não há outro SPF no domínio (só pode existir um).

## Relacionado
- `pages/11-settings-email-domain.md`
- `journeys/enviar-campanha-email.md`
