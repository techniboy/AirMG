import { useFrame, useThree } from "@react-three/fiber";
import { atom } from "jotai";
import { useRef } from "react";

/** Render quality. One-way ratchets high → low when the GPU can't keep up. */
export const qualityAtom = atom<"high" | "low">("high");

/** OS "reduce motion" preference, sampled once at module load. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Idle-animation rate multiplier — near-frozen under reduced motion. */
export const RM = prefersReducedMotion() ? 0.15 : 1;

const WINDOW = 120; // frames per FPS sample
const SUSTAIN = 5; // seconds below threshold before acting

/**
 * Auto-degrade watchdog (mounted inside the Canvas). Tracks a rolling
 * 120-frame average FPS: sustained <45 → onLow() (Effects falls to
 * tonemap-only); a further sustained <30 → DPR 1. One-way only — never
 * upgrades within a session, so it can't oscillate.
 */
export function PerfMonitor({ onLow }: { onLow: () => void }) {
  const setDpr = useThree((s) => s.setDpr);
  const s = useRef({ frames: 0, time: 0, bad: 0, low: false, dropped: false });

  useFrame((_, delta) => {
    const m = s.current;
    if (m.dropped) return; // bottomed out — stop watching
    m.frames += 1;
    // clamp outlier frames (GC pause, breakpoint, tab stall) so one bad
    // frame can't trip the irreversible ratchet
    m.time += Math.min(delta, 0.1);
    if (m.frames < WINDOW) return;

    const fps = m.frames / m.time;
    const dur = m.time;
    m.frames = 0;
    m.time = 0;

    if (fps >= (m.low ? 30 : 45)) {
      m.bad = 0;
      return;
    }
    m.bad += dur;
    if (m.bad < SUSTAIN) return;
    m.bad = 0;
    if (!m.low) {
      m.low = true;
      onLow();
    } else {
      m.dropped = true;
      setDpr(1);
    }
  });

  return null;
}
