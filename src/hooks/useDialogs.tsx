import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ConfirmDialog, type ConfirmDialogProps } from "@/components/ui/confirm-dialog";
import { PromptDialog, type PromptDialogProps } from "@/components/ui/prompt-dialog";

type ConfirmOpts = Omit<ConfirmDialogProps, "open" | "onOpenChange" | "onConfirm">;
type PromptOpts = Omit<PromptDialogProps, "open" | "onOpenChange" | "onSubmit">;

type Ctx = {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<string | null>;
};

const DialogsCtx = createContext<Ctx | null>(null);

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<
    (ConfirmOpts & { open: boolean; resolve?: (v: boolean) => void }) | null
  >(null);
  const [promptState, setPromptState] = useState<
    (PromptOpts & { open: boolean; resolve?: (v: string | null) => void }) | null
  >(null);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...opts, open: true, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOpts) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({ ...opts, open: true, resolve });
    });
  }, []);

  return (
    <DialogsCtx.Provider value={{ confirm, prompt }}>
      {children}
      {confirmState && (
        <ConfirmDialog
          {...confirmState}
          open={confirmState.open}
          onOpenChange={(v) => {
            if (!v) {
              confirmState.resolve?.(false);
              setConfirmState((s) => (s ? { ...s, open: false } : null));
            }
          }}
          onConfirm={async () => {
            confirmState.resolve?.(true);
            setConfirmState((s) => (s ? { ...s, open: false } : null));
          }}
        />
      )}
      {promptState && (
        <PromptDialog
          {...promptState}
          open={promptState.open}
          onOpenChange={(v) => {
            if (!v) {
              promptState.resolve?.(null);
              setPromptState((s) => (s ? { ...s, open: false } : null));
            }
          }}
          onSubmit={async (val) => {
            promptState.resolve?.(val);
            setPromptState((s) => (s ? { ...s, open: false } : null));
          }}
        />
      )}
    </DialogsCtx.Provider>
  );
}

export function useDialogs() {
  const ctx = useContext(DialogsCtx);
  if (!ctx) throw new Error("useDialogs must be used inside DialogsProvider");
  return ctx;
}

export const useConfirm = () => useDialogs().confirm;
export const usePrompt = () => useDialogs().prompt;
