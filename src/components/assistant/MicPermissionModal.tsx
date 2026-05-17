import { motion, AnimatePresence } from "framer-motion";
import { Mic, ShieldCheck, X } from "lucide-react";
import { useAssistant } from "@/lib/assistant-store";

export function MicPermissionModal() {
  const open = useAssistant((s) => s.permissionModalOpen);
  const setOpen = useAssistant((s) => s.setPermissionModalOpen);
  const setPermission = useAssistant((s) => s.setMicPermission);
  const status = useAssistant((s) => s.micPermission);

  const request = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermission("granted");
      setOpen(false);
      window.dispatchEvent(new Event("misty:microphone-granted"));
    } catch (error) {
      console.error("Microphone permission request failed", error);
      setPermission("denied");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[min(420px,calc(100vw-2rem))] glass-card p-6"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 h-7 w-7 grid place-items-center rounded-lg hover:bg-white/5 transition"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="relative h-16 w-16 mb-4">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[color:var(--violet)] to-[color:var(--cyan)] blur-xl opacity-60 animate-pulse-glow" />
                <span className="relative h-16 w-16 grid place-items-center rounded-full bg-background/60 border border-white/15">
                  <Mic className="h-7 w-7 text-[color:var(--violet)]" />
                </span>
              </div>
              <h2 className="font-display text-lg font-semibold">Let Misty hear you</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Voice mode uses your microphone to listen while you speak. Audio stays on your
                device — only the transcript is sent for responses.
              </p>

              <div className="mt-4 w-full space-y-2 text-left">
                <Bullet>Push-to-talk and continuous listening</Bullet>
                <Bullet>Visual waveform of your voice</Bullet>
                <Bullet>You can revoke access anytime in browser settings</Bullet>
              </div>

              {status === "denied" && (
                <p className="mt-3 text-xs text-[color:var(--rose)]">
                  Microphone access was blocked. Enable it from your browser's site settings, then
                  retry.
                </p>
              )}

              <div className="mt-5 flex gap-2 w-full">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm transition"
                >
                  Not now
                </button>
                <button
                  onClick={request}
                  className="flex-1 h-10 rounded-lg bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black text-sm font-medium hover:opacity-90 transition inline-flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Allow microphone
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <span className="mt-1 h-1 w-1 rounded-full bg-[color:var(--violet)] shrink-0" />
      <span>{children}</span>
    </div>
  );
}
