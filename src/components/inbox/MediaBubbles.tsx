import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Mic, FileText, Image as ImageIcon, Film, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/crm";
import { toast } from "sonner";
import { useSignedMediaUrl } from "@/lib/media-url";

function fmtDuration(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Global single-audio coordinator: starting one audio pauses any other.
let currentAudio: HTMLAudioElement | null = null;
function setCurrentAudio(a: HTMLAudioElement) {
  if (currentAudio && currentAudio !== a) {
    try { currentAudio.pause(); } catch {}
  }
  currentAudio = a;
}

function fmtBytes(n?: number | null) {
  if (!n || !isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function getFilename(url: string, mime: string, id: string, raw?: any) {
  const declared = raw?.message?.documentMessage?.fileName
    ?? raw?.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName
    ?? raw?.fileName;
  if (declared) return String(declared);
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "";
    if (last && last.includes(".")) return decodeURIComponent(last);
  } catch {}
  const ext = (mime.split("/")[1] || "bin").split(";")[0];
  return `arquivo-${id.slice(0, 8)}.${ext}`;
}

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  } catch {
    toast.error("Falha ao baixar arquivo");
  }
}

/* =========================== AUDIO =========================== */
const SPEEDS = [1, 1.5, 2];

export function WhatsAppAudio({ m, fromMe }: { m: Message; fromMe: boolean }) {
  const { url: signedUrl, loading: urlLoading } = useSignedMediaUrl(m.media_url);
  const url = signedUrl ?? "";
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const filename = getFilename(url, m.media_mime ?? "audio/ogg", m.id, (m as any).raw);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    const onPause = () => setPlaying(false);
    const onPlay = () => { setCurrentAudio(a); setPlaying(true); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
    };
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { setCurrentAudio(a); a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * duration;
    setCurrent(a.currentTime);
  }

  function cycleSpeed() {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const shown = playing || current > 0 ? current : duration;

  return (
    <div className={cn(
      "mb-1 flex items-center gap-2 rounded-2xl px-2 py-2 min-w-[240px]",
      fromMe ? "bg-primary/10" : "bg-background/60"
    )}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={toggle}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
          fromMe ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-foreground/80 text-background hover:bg-foreground"
        )}
        aria-label={playing ? "Pausar" : "Reproduzir"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
      </button>

      <div className="relative flex-1 min-w-0">
        <div
          onClick={seek}
          className="relative h-7 cursor-pointer flex items-center"
        >
          {/* faux waveform */}
          <div className="flex h-full w-full items-center gap-[2px]">
            {Array.from({ length: 32 }).map((_, i) => {
              const h = 30 + ((i * 37) % 70);
              const passed = (i / 32) * 100 < pct;
              return (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className={cn(
                    "w-[2px] rounded-full transition-colors",
                    passed ? (fromMe ? "bg-primary" : "bg-foreground/80") : "bg-foreground/25"
                  )}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Mic className="h-2.5 w-2.5" />
            {fmtDuration(shown)}
          </span>
          <button
            onClick={cycleSpeed}
            className="rounded bg-foreground/10 px-1.5 py-0.5 text-[9px] font-semibold hover:bg-foreground/20"
            title="Velocidade"
          >
            {SPEEDS[speedIdx]}x
          </button>
        </div>
      </div>

      <button
        onClick={() => downloadFile(url, filename)}
        title="Baixar"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* =========================== IMAGE =========================== */
export function WhatsAppImage({ m }: { m: Message }) {
  const [open, setOpen] = useState(false);
  const { url: signedUrl, loading: urlLoading } = useSignedMediaUrl(m.media_url);
  const url = signedUrl ?? "";
  const filename = getFilename(url || (m.media_url ?? ""), m.media_mime ?? "image/jpeg", m.id, (m as any).raw);

  if (urlLoading || !url) {
    return (
      <div className="mb-1 flex h-40 w-60 items-center justify-center rounded-lg bg-muted/40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="group relative mb-1 inline-block max-w-full">
        <button onClick={() => setOpen(true)} className="block overflow-hidden rounded-lg">
          <img
            src={url}
            alt=""
            loading="lazy"
            onLoad={() => window.dispatchEvent(new Event("msg-media-loaded"))}
            className="max-h-80 w-auto max-w-full object-cover transition-transform group-hover:scale-[1.01]"
          />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); downloadFile(url, filename); }}
          title="Baixar"
          className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 shadow backdrop-blur transition group-hover:opacity-100 hover:bg-background"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); downloadFile(url, filename); }}
            className="absolute right-16 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            title="Baixar"
          >
            <Download className="h-4 w-4" />
          </button>
          <img
            src={url}
            alt=""
            className="max-h-[90vh] max-w-[95vw] rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/* =========================== VIDEO =========================== */
export function WhatsAppVideo({ m }: { m: Message }) {
  const { url: signedUrl, loading: urlLoading } = useSignedMediaUrl(m.media_url);
  const url = signedUrl ?? "";
  const filename = getFilename(url || (m.media_url ?? ""), m.media_mime ?? "video/mp4", m.id, (m as any).raw);
  if (urlLoading || !url) {
    return (
      <div className="mb-1 flex h-40 w-60 items-center justify-center rounded-lg bg-muted/40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="group relative mb-1 inline-block max-w-full">
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={() => window.dispatchEvent(new Event("msg-media-loaded"))}
        className="max-h-80 w-auto max-w-full rounded-lg bg-black"
      />
      <button
        onClick={() => downloadFile(url, filename)}
        title="Baixar"
        className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 shadow backdrop-blur transition group-hover:opacity-100 hover:bg-background"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* =========================== DOCUMENT =========================== */
export function WhatsAppDocument({ m, fromMe }: { m: Message; fromMe: boolean }) {
  const { url: signedUrl } = useSignedMediaUrl(m.media_url);
  const url = signedUrl ?? m.media_url ?? "";
  const mime = m.media_mime ?? "";
  const raw = (m as any).raw;
  const filename = getFilename(url, mime, m.id, raw);
  const size = raw?.message?.documentMessage?.fileLength
    ?? raw?.message?.documentWithCaptionMessage?.message?.documentMessage?.fileLength
    ?? raw?.fileLength;
  const sizeNum = typeof size === "string" ? Number(size) : size;
  const ext = (filename.split(".").pop() || "FILE").toUpperCase().slice(0, 4);

  const Icon = mime.startsWith("image/") ? ImageIcon : mime.startsWith("video/") ? Film : FileText;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 min-w-[220px] max-w-[320px] transition",
        fromMe ? "bg-primary/10 hover:bg-primary/15" : "bg-background/60 hover:bg-background/80"
      )}
    >
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[9px] font-bold uppercase tracking-wider",
        fromMe ? "bg-primary/25 text-primary-foreground" : "bg-foreground/15 text-foreground"
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{filename}</div>
        <div className="text-[10px] text-muted-foreground">
          {ext}{sizeNum ? ` · ${fmtBytes(sizeNum)}` : ""}
        </div>
      </div>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadFile(url, filename); }}
        title="Baixar"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </a>
  );
}

/* =========================== ROUTER =========================== */
export function MediaBubble({ m, fromMe }: { m: Message; fromMe: boolean }) {
  const mime = m.media_mime ?? "";
  const type = m.message_type;
  if (type === "image" || mime.startsWith("image/")) return <WhatsAppImage m={m} />;
  if (type === "video" || mime.startsWith("video/")) return <WhatsAppVideo m={m} />;
  if (type === "audio" || mime.startsWith("audio/")) return <WhatsAppAudio m={m} fromMe={fromMe} />;
  return <WhatsAppDocument m={m} fromMe={fromMe} />;
}
