import type { ReactNode } from "react";
import { useNavigate } from "react-router";

/**
 * Console panel — a centered holo-glass surface that hosts the existing 2D
 * pages over the (blurred, still-live) 3D scene. One panel per console route;
 * keyed by pathname in OrbitalWorld so each route change replays the
 * entrance animation. Esc is handled globally in OrbitalWorld.
 */
export default function ConsolePanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="console-layer">
      <section className="console-panel" aria-label={`${title} console`}>
        <header className="console-header">
          <span className="console-title">{title}</span>
          <button
            type="button"
            className="console-close"
            onClick={() => navigate("/")}
            aria-label="Close console, return to orbit"
            title="Return to orbit (Esc)"
          >
            ✕
          </button>
        </header>
        <div className="console-body">{children}</div>
      </section>
    </div>
  );
}
