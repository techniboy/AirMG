import { Canvas } from "@react-three/fiber";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import * as THREE from "three/webgpu";
import CameraRig from "./cameraRig";
import Dock from "./hud/Dock";
import { hoveredObjectAtom } from "./hud/hoverAtom";
import LandingHud from "./hud/LandingHud";
import Atmosphere from "./scene/Atmosphere";
import Aurora from "./scene/Aurora";
import Effects from "./scene/Effects";
import MoonSat from "./scene/MoonSat";
import Planet from "./scene/Planet";
import Star from "./scene/Star";
import Starfield from "./scene/Starfield";
import { worldStateAtom } from "./worldState";
import "./orbital.css";

export default function OrbitalWorld() {
  const location = useLocation();
  const navigate = useNavigate();
  // read here (main React root) — the Canvas reconciler doesn't see JotaiProvider
  const world = useAtomValue(worldStateAtom);
  // HUD panel hover → scene highlight (same constraint: atom read out here)
  const hudHover = useAtomValue(hoveredObjectAtom);
  const [ready, setReady] = useState(false);

  // navigation handlers live in the DOM root (router context is not
  // available inside the Canvas — it is a separate React root)
  const goRecovery = useCallback(() => navigate("/recovery"), [navigate]);
  const goSleep = useCallback(() => navigate("/sleep"), [navigate]);
  const goStrain = useCallback(() => navigate("/strain"), [navigate]);

  // Esc returns to orbit. Listener only exists while the orbital theme is
  // mounted; cleaned up on unmount/theme switch.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // don't hijack Esc from form fields (console pages, Task 11)
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      navigate("/", { replace: true });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      // unmount mid-hover (theme switch) never fires pointerout — unstick cursor
      document.body.style.cursor = "";
    };
  }, [navigate]);

  return (
    <div className="orbital-root">
      <div className={`orbital-fade${ready ? " is-ready" : ""}`}>
        <Canvas
          dpr={[1, 2]}
          camera={{ fov: 45, position: [0, 1.2, 9], near: 0.1, far: 2000 }}
          gl={async (props) => {
            const renderer = new THREE.WebGPURenderer({
              ...(props as object),
              antialias: true,
            });
            await renderer.init();
            const backend = renderer.backend as { isWebGPUBackend?: boolean };
            console.info(
              `[orbital] three r${THREE.REVISION} — backend: ${
                backend.isWebGPUBackend === true ? "webgpu" : "webgl (fallback)"
              }`,
            );
            return renderer;
          }}
          onCreated={(state) => {
            setReady(true);
            if (import.meta.env.DEV) {
              // dev-only escape hatch for Playwright verification (moving
              // bodies need live projection to be clicked reliably)
              (window as unknown as { __orbital?: unknown }).__orbital = state;
            }
          }}
        >
          <color attach="background" args={["#04060d"]} />
          <ambientLight intensity={0.12} color="#a8c2ff" />
          <CameraRig pathname={location.pathname} />
          {/* key light lives inside Star, at SUN_POSITION; Task 13 feeds flares */}
          <Star world={world} onSelect={goStrain} hovered={hudHover === "star"} />
          <group>
            <Planet world={world} onSelect={goRecovery} hovered={hudHover === "planet"} />
            <Atmosphere world={world} />
            <Aurora world={world} />
          </group>
          <MoonSat world={world} onSelectMoon={goSleep} hovered={hudHover === "moon"} />
          <Starfield />
          <Effects quality="high" />
        </Canvas>
      </div>
      <LandingHud world={world} visible={location.pathname === "/"} />
      <Dock pathname={location.pathname} />
      {/* a11y mirrors for the clickable bodies (canvas raycast targets) */}
      <div className="orbital-sr-nav">
        <button type="button" className="orbital-sr-only" onClick={goRecovery}>
          View recovery planet
        </button>
        <button type="button" className="orbital-sr-only" onClick={goSleep}>
          View sleep moon
        </button>
        <button type="button" className="orbital-sr-only" onClick={goStrain}>
          View strain star
        </button>
      </div>
    </div>
  );
}
