import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Power, RotateCcw, CheckCircle2, AlertCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useDialogs } from "@/hooks/useDialogs";

type QrResp = {
  ok: boolean;
  state?: string;
  base64?: string | null;
  pairingCode?: string | null;
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId?: string | null;
  instanceName?: string;
};

export function WhatsAppQrDialog({ open, onOpenChange, instanceId, instanceName }: Props) {
  const [data, setData] = useState<QrResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<null | "logout" | "restart">(null);
  const pollRef = useRef<number | null>(null);
  const { confirm } = useDialogs();

  async function fetchQr(showLoading = true) {
    if (showLoading) setLoading(true);
    const { data: resp, error } = await supabase.functions.invoke("evolution-qr", {
      body: { instance_id: instanceId ?? null },
    });
    setLoading(false);
    if (error) {
      setData({ ok: false, error: error.message });
      return;
    }
    const d = resp as QrResp;
    setData(d);
    if (d.state === "open" && open) {
      toast.success("WhatsApp conectado!");
      supabase.functions.invoke("evolution-health").catch(() => {});
      onOpenChange(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    fetchQr(true);
    pollRef.current = window.setInterval(() => fetchQr(false), 5000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, instanceId]);

  async function handleLogout() {
    const ok = await confirm({
      title: "Desconectar WhatsApp?",
      description: "A sessão atual será encerrada. Você precisará escanear o QR Code novamente.",
      confirmLabel: "Desconectar",
      variant: "destructive",
    });
    if (!ok) return;
    setActing("logout");
    const { data: resp, error } = await supabase.functions.invoke("evolution-logout", {
      body: { instance_id: instanceId ?? null },
    });
    setActing(null);
    if (error || !(resp as any)?.ok) {
      toast.error("Erro: " + (error?.message ?? (resp as any)?.error ?? "falha"));
      return;
    }
    toast.success("Desconectado. Gerando novo QR…");
    setTimeout(() => fetchQr(true), 1500);
  }

  async function handleRestart() {
    setActing("restart");
    const { data: resp, error } = await supabase.functions.invoke("evolution-restart", {
      body: { instance_id: instanceId ?? null },
    });
    setActing(null);
    if (error || !(resp as any)?.ok) {
      toast.error("Erro: " + (error?.message ?? (resp as any)?.error ?? "falha"));
      return;
    }
    toast.success("Instância reiniciada");
    setTimeout(() => fetchQr(true), 2000);
  }

  const state = data?.state;
  const isOpen = state === "open";
  const isConnecting = state === "connecting";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Conectar WhatsApp{instanceName ? ` — ${instanceName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Abra o WhatsApp no seu celular → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong> e escaneie o código.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          {/* Status badge */}
          <div className="flex items-center gap-2 text-xs">
            {isOpen ? (
              <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> <span className="font-medium text-emerald-600">Conectado</span></>
            ) : isConnecting ? (
              <><Loader2 className="h-3 w-3 animate-spin text-amber-500" /> <span className="font-medium text-amber-600">Conectando…</span></>
            ) : data?.ok === false ? (
              <><AlertCircle className="h-3 w-3 text-destructive" /> <span className="font-medium text-destructive">Erro</span></>
            ) : (
              <><AlertCircle className="h-3 w-3 text-muted-foreground" /> <span className="text-muted-foreground">Aguardando leitura</span></>
            )}
          </div>

          {/* QR display */}
          <div className="flex h-64 w-64 items-center justify-center rounded-lg border bg-muted/40">
            {loading && !data ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : isOpen ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            ) : data?.base64 ? (
              <img src={data.base64} alt="QR Code WhatsApp" className="h-full w-full rounded-lg object-contain p-2" />
            ) : data?.error ? (
              <div className="px-4 text-center text-xs text-destructive">{data.error}</div>
            ) : (
              <div className="px-4 text-center text-xs text-muted-foreground">Sem QR disponível ainda. Tente atualizar.</div>
            )}
          </div>

          {data?.pairingCode && !isOpen && (
            <div className="text-center text-xs">
              <div className="text-muted-foreground">ou use o código de pareamento</div>
              <div className="mt-1 font-mono text-base font-semibold tracking-widest">{data.pairingCode}</div>
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground">
            O QR atualiza automaticamente a cada 5 segundos.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => fetchQr(true)} disabled={loading}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleRestart} disabled={acting !== null}>
            {acting === "restart" ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-2 h-3 w-3" />}
            Reiniciar
          </Button>
          {isOpen && (
            <Button variant="destructive" size="sm" onClick={handleLogout} disabled={acting !== null}>
              {acting === "logout" ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Power className="mr-2 h-3 w-3" />}
              Desconectar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
