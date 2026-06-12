import type { HTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";

/** Glass panel primitive — hairline border, inner highlight, layered depth. */
export function HudPanel({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`hud-panel ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

const DURATION_MS = 600;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Animated numeral: rAF count-up (~600ms, ease-out cubic) from the previously
 * displayed value, so re-targets mid-flight stay smooth. null renders "--".
 */
export function CountUp({
  value,
  decimals = 0,
}: {
  value: number | null;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  // last painted number — animation origin for the next target
  const shownRef = useRef(0);

  useEffect(() => {
    if (value == null) return; // "--" is derived at render time
    const from = shownRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const v = from + (value - from) * easeOutCubic(t);
      shownRef.current = v;
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className="hud-num">
      {value == null ? "--" : display.toFixed(decimals)}
    </span>
  );
}
