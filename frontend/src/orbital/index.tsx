import { Canvas } from "@react-three/fiber";
import { useAtomValue } from "jotai";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import * as THREE from "three/webgpu";
import { baselinesAtom, todayMetricsAtom } from "../atoms/api";
import Coach from "../pages/Coach";
import HealthAge from "../pages/HealthAge";
import Insights from "../pages/Insights";
import Journal from "../pages/Journal";
import Settings from "../pages/Settings";
import Trends from "../pages/Trends";
import Workouts from "../pages/Workouts";
import CameraRig from "./cameraRig";
import ConsolePanel from "./hud/ConsolePanel";
import Dock from "./hud/Dock";
import { hoveredObjectAtom } from "./hud/hoverAtom";
import LandingHud from "./hud/LandingHud";
import RecoveryHud from "./hud/RecoveryHud";
import SleepHud from "./hud/SleepHud";
import Atmosphere from "./scene/Atmosphere";
import Aurora from "./scene/Aurora";
import Effects from "./scene/Effects";
import MoonSat from "./scene/MoonSat";
import Planet from "./scene/Planet";
import RecoveryRings from "./scene/RecoveryRings";
import SleepDescent from "./scene/SleepDescent";
import Star from "./scene/Star";
import Starfield from "./scene/Starfield";
import { asSleepSession, decimateStages, orbitalSleepAtom } from "./sleepData";
import { asMetrics, computeRingMetrics, worldStateAtom } from "./worldState";
import "./orbital.css";

// console routes — existing 2D pages rendered as glass panels over the scene.
// Shell renders OrbitalWorld INSTEAD of the router <Outlet/>, so the
// pathname→component map lives here (camera flies to CONSOLE_TARGET for
// any of these — see cameraRig.tsx).
const CONSOLE_PAGES: Record<string, { title: string; Page: ComponentType }> = {
  "/workouts": { title: "Workouts", Page: Workouts },
  "/trends": { title: "Trends", Page: Trends },
  "/insights": { title: "Insights", Page: Insights },
  "/coach": { title: "Coach", Page: Coach },
  "/journal": { title: "Journal", Page: Journal },
  "/health-age": { title: "Health Age", Page: HealthAge },
  "/settings": { title: "Settings", Page: Settings },
};

export default function OrbitalWorld() {
  const location = useLocation();
  const navigate = useNavigate();
  // read here (main React root) — the Canvas reconciler doesn't see JotaiProvider
  const world = useAtomValue(worldStateAtom);
  // HUD panel hover → scene highlight (same constraint: atom read out here)
  const hudHover = useAtomValue(hoveredObjectAtom);
  const [ready, setReady] = useState(false);
  const consolePage = CONSOLE_PAGES[location.pathname];
  const onRecovery = location.pathname === "/recovery";
  const onSleep = location.pathname === "/sleep";

  // recovery diorama data — read here (atoms invisible to the Canvas root),
  // passed down as props like `world`
  const todayQuery = useAtomValue(todayMetricsAtom);
  const baselinesQuery = useAtomValue(baselinesAtom);
  const today = asMetrics(todayQuery.data);
  const baselines = baselinesQuery.data;
  const ringMetrics = useMemo(
    () => computeRingMetrics(today, baselines ?? {}),
    [today, baselines],
  );

  // sleep diorama data — day follows controlCenterDayAtom (DateNav time
  // travel re-draws the descent track); decimation memoized per session
  const sleepQuery = useAtomValue(orbitalSleepAtom);
  const sleepSession = asSleepSession(sleepQuery.data);
  const sleepTrack = useMemo(
    () => (sleepSession?.stages ? decimateStages(sleepSession.stages) : null),
    [sleepSession],
  );

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
      <div
        className={`orbital-fade${ready ? " is-ready" : ""}${consolePage ? " is-console" : ""}`}
      >
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
          <RecoveryRings metrics={ringMetrics} active={onRecovery} />
          <SleepDescent track={sleepTrack} active={onSleep} />
          <Starfield />
          <Effects quality="high" />
        </Canvas>
      </div>
      <LandingHud world={world} visible={location.pathname === "/"} />
      <RecoveryHud
        metrics={ringMetrics}
        recovery={today?.recovery ?? null}
        visible={onRecovery}
      />
      <SleepHud session={sleepSession} visible={onSleep} />
      {consolePage && (
        // keyed by pathname — route changes remount and replay the entrance
        <ConsolePanel key={location.pathname} title={consolePage.title}>
          <consolePage.Page />
        </ConsolePanel>
      )}
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
