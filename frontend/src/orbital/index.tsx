import { Canvas } from "@react-three/fiber";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useLocation } from "react-router";
import * as THREE from "three/webgpu";
import Atmosphere from "./scene/Atmosphere";
import Aurora from "./scene/Aurora";
import Effects from "./scene/Effects";
import Planet, { SUN_POSITION } from "./scene/Planet";
import Starfield from "./scene/Starfield";
import { worldStateAtom } from "./worldState";
import "./orbital.css";

export default function OrbitalWorld() {
  const location = useLocation();
  // read here (main React root) — the Canvas reconciler doesn't see JotaiProvider
  const world = useAtomValue(worldStateAtom);
  const [ready, setReady] = useState(false);

  return (
    <div className="orbital-root">
      {/* debug: keep location wired so routing stays alive */}
      <span style={{ display: "none" }}>{location.pathname}</span>
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
          onCreated={() => setReady(true)}
        >
          <color attach="background" args={["#04060d"]} />
          <ambientLight intensity={0.12} color="#a8c2ff" />
          {/* key light sits where the star will live (Task 8) */}
          <directionalLight
            position={SUN_POSITION.toArray()}
            intensity={1.4}
            color="#dbe7ff"
          />
          <group>
            <Planet world={world} />
            <Atmosphere world={world} />
            <Aurora world={world} />
          </group>
          <Starfield />
          <Effects quality="high" />
        </Canvas>
      </div>
    </div>
  );
}
