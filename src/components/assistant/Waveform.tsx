import { useEffect, useRef } from "react";
import { useAssistant } from "@/lib/assistant-store";

/** Bar-style reactive waveform. Driven by store's micLevel (0..1)
 * with idle breathing when not listening. */
export function Waveform({ bars = 28, className = "" }: { bars?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const status = useAssistant((s) => s.status);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = () => {
      const root = ref.current;
      if (root) {
        const level = useAssistant.getState().micLevel;
        const now = performance.now() / 1000;
        const children = root.children;
        for (let i = 0; i < children.length; i++) {
          const el = children[i] as HTMLDivElement;
          const phase = i * 0.35;
          const idle = 0.18 + Math.sin(now * 2 + phase) * 0.06;
          const active =
            status === "listening"
              ? level * (0.55 + Math.abs(Math.sin(now * 6 + phase)) * 0.45)
              : status === "speaking"
                ? 0.35 + Math.abs(Math.sin(now * 8 + phase)) * 0.55
                : status === "thinking"
                  ? 0.2 + Math.abs(Math.sin(now * 3 + phase)) * 0.2
                  : idle;
          const scale = prefersReducedMotion ? 0.24 : Math.max(0.12, Math.min(1, active));
          el.style.transform = `scaleY(${scale})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  return (
    <div
      ref={ref}
      className={`flex items-center justify-center gap-[3px] h-10 ${className}`}
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="h-full w-[3px] origin-center rounded-full bg-gradient-to-t from-[color:var(--violet)] to-[color:var(--cyan)] will-change-transform"
          style={{ transform: "scaleY(0.2)" }}
        />
      ))}
    </div>
  );
}
