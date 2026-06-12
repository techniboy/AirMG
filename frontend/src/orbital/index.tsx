import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import * as THREE from "three/webgpu";
import Effects from "./scene/Effects";
import Starfield from "./scene/Starfield";
import "./orbital.css";

/** Temporary planet stand-in so bloom/tonemap have something to frame. */
function Planet() {
  const material = useMemo(
    () =>
      new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color("#27303d"),
        roughness: 0.6,
        metalness: 0.2,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material}>
      <sphereGeometry args={[1.5, 96, 96]} />
    </mesh>
  );
}

export default function OrbitalWorld() {
  const location = useLocation();
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
          <directionalLight position={[6, 4, 5]} intensity={1.4} color="#dbe7ff" />
          <directionalLight position={[-7, -2, -4]} intensity={0.3} color="#41527f" />
          <Planet />
          <Starfield />
          <Effects quality="high" />
        </Canvas>
      </div>
    </div>
  );
}
