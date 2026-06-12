import { Canvas } from "@react-three/fiber";
import { useLocation } from "react-router";
import "./orbital.css";

export default function OrbitalWorld() {
  const location = useLocation();

  return (
    <div className="orbital-root">
      {/* debug: keep location wired so routing stays alive */}
      <span style={{ display: "none" }}>{location.pathname}</span>
      <Canvas>
        <mesh>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color="#ffffff" wireframe />
        </mesh>
      </Canvas>
    </div>
  );
}
