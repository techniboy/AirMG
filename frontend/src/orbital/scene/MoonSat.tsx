import { useFrame } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import {
  color,
  cos,
  float,
  mix,
  mx_fractal_noise_float,
  normalWorld,
  oneMinus,
  positionLocal,
  sin,
  smoothstep,
  time,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import { DORMANT, type WorldState } from "../worldState";

const MOON_RADIUS = 0.5;
const MOON_ORBIT_RADIUS = 4.5;
const MOON_ORBIT_SPEED = 0.02; // rad/s
const MOON_INCLINATION = 0.14; // ~8°
const MOON_START_ANGLE = 3.45; // left of the planet, slightly camera-side

const SAT_ORBIT_RADIUS = 3.2;
const SAT_INCLINATION = 0.35; // ~20°
const SAT_START_ANGLE = 5.8; // front-right, crossing the disc soon
const SAT_SCALE = 0.16;

const makeMoonUniforms = () => ({
  phase: uniform(DORMANT.moonPhase),
});
type MoonUniforms = ReturnType<typeof makeMoonUniforms>;

/**
 * Grey-blue cratered moon with a phase terminator. The "light" is a phase
 * angle, not real sun geometry: it swings from behind the moon (phase 0,
 * new) through the right (half) to the camera axis (phase 1, full), so the
 * lit fraction seen from the landing camera matches `moonPhase`.
 */
function buildMoonMaterial(u: MoonUniforms): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial();

  const phaseAngle = oneMinus(u.phase).mul(Math.PI);
  const lightDir = vec3(sin(phaseAngle), float(0), cos(phaseAngle));
  const ndl = normalWorld.normalize().dot(lightDir);
  const lit = smoothstep(-0.18, 0.12, ndl);

  // maria + small dark pocks (object space — rotates with the moon)
  const p = positionLocal.div(MOON_RADIUS);
  const maria = mx_fractal_noise_float(p.mul(2.1).add(7.7), 4, 2.1, 0.55)
    .mul(0.5)
    .add(0.5);
  const pocks = smoothstep(
    0.56,
    0.95,
    mx_fractal_noise_float(p.mul(9.0).add(3.1), 3, 2.3, 0.6).mul(0.5).add(0.5),
  );
  const albedo = mix(
    mix(color("#5d6878"), color("#a8b4c2"), maria),
    color("#454e5c"),
    pocks.mul(0.55),
  );

  // faint cold earthshine keeps the dark limb from vanishing entirely
  const rgb = albedo
    .mul(lit.mul(1.18).add(0.035))
    .add(color("#26344e").mul(oneMinus(lit)).mul(0.08));
  material.colorNode = vec4(rgb, 1);
  return material;
}

/** Body + panels are lit standard materials; the beacon is a TSL blinker. */
function buildSatMaterials() {
  // faint self-illumination keeps the craft readable on its shadowed side
  const body = new THREE.MeshStandardNodeMaterial({
    color: "#ccd4de",
    metalness: 0.85,
    roughness: 0.35,
    emissive: "#9aa4b4",
    emissiveIntensity: 0.9,
  });
  const panel = new THREE.MeshStandardNodeMaterial({
    color: "#23498f",
    metalness: 0.7,
    roughness: 0.3,
    emissive: "#3566c8",
    emissiveIntensity: 1.1,
  });
  // warm beacon: sharp pulse, 2s period, peak well above the bloom threshold
  const beacon = new THREE.MeshBasicNodeMaterial();
  const blink = sin(time.mul(Math.PI)).mul(0.5).add(0.5).pow(8);
  beacon.colorNode = vec4(color("#ffa64d").mul(blink.mul(4.5).add(0.3)), 1);
  return { body, panel, beacon };
}

export default function MoonSat({ world }: { world: WorldState }) {
  const moonOrbit = useRef<THREE.Group>(null);
  const moonMesh = useRef<THREE.Mesh>(null);
  const satOrbit = useRef<THREE.Group>(null);
  const satBody = useRef<THREE.Group>(null);
  const satSpeed = useRef(DORMANT.satelliteSpeed);

  const { moonUniforms, moonMaterial, satMaterials } = useMemo(() => {
    const u = makeMoonUniforms();
    return {
      moonUniforms: u,
      moonMaterial: buildMoonMaterial(u),
      satMaterials: buildSatMaterials(),
    };
  }, []);

  useEffect(
    () => () => {
      moonMaterial.dispose();
      satMaterials.body.dispose();
      satMaterials.panel.dispose();
      satMaterials.beacon.dispose();
    },
    [moonMaterial, satMaterials],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    damp(moonUniforms.phase, "value", world.moonPhase, 1.5, dt);
    damp(satSpeed, "current", world.satelliteSpeed, 2, dt);

    if (moonOrbit.current) moonOrbit.current.rotation.y += MOON_ORBIT_SPEED * dt;
    if (moonMesh.current) moonMesh.current.rotation.y += 0.012 * dt;
    if (satOrbit.current) satOrbit.current.rotation.y += satSpeed.current * dt;
    if (satBody.current) {
      // slight tumble
      satBody.current.rotation.x += 0.14 * dt;
      satBody.current.rotation.y += 0.2 * dt;
    }
  });

  return (
    <group>
      {/* -- moon -- */}
      <group rotation-x={MOON_INCLINATION}>
        <group ref={moonOrbit} rotation-y={MOON_START_ANGLE}>
          <mesh
            ref={moonMesh}
            material={moonMaterial}
            position={[MOON_ORBIT_RADIUS, 0, 0]}
          >
            <sphereGeometry args={[MOON_RADIUS, 48, 48]} />
          </mesh>
        </group>
      </group>

      {/* -- satellite -- */}
      <group rotation-z={SAT_INCLINATION}>
        <group ref={satOrbit} rotation-y={SAT_START_ANGLE}>
          <group
            ref={satBody}
            position={[SAT_ORBIT_RADIUS, 0, 0]}
            scale={SAT_SCALE}
          >
            <mesh material={satMaterials.body}>
              <boxGeometry args={[0.5, 0.5, 1.1]} />
            </mesh>
            <mesh material={satMaterials.panel} position={[1.05, 0, 0]}>
              <boxGeometry args={[1.6, 0.04, 0.7]} />
            </mesh>
            <mesh material={satMaterials.panel} position={[-1.05, 0, 0]}>
              <boxGeometry args={[1.6, 0.04, 0.7]} />
            </mesh>
            <mesh material={satMaterials.beacon} position={[0, 0.36, 0]}>
              <sphereGeometry args={[0.16, 12, 12]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
