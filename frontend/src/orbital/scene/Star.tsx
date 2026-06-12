import { useFrame } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import {
  cameraPosition,
  clamp,
  color,
  float,
  instancedBufferAttribute,
  mix,
  mx_fractal_noise_float,
  oneMinus,
  positionLocal,
  positionWorld,
  smoothstep,
  time,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { DORMANT, type WorldState } from "../worldState";
import { SUN_POSITION } from "./Planet";

export const STAR_RADIUS = 2.6;

/** One solar flare spike on the equatorial ring (fed by Task 13). */
export interface Flare {
  /** radians around the ring */
  angle: number;
  /** 0..1 → spike length (workout strain) */
  height: number;
  /** 0 warm amber .. 1 hot magenta */
  hue?: number;
}

const MAX_FLARES = 32;
const FLARE_BASE_RADIUS = STAR_RADIUS * 0.99;

interface ShellSpec {
  /** radius as a multiple of STAR_RADIUS */
  radius: number;
  /** edge falloff exponent — higher hugs the core tighter */
  power: number;
  /** how much coronaActivity inflates this shell */
  grow: number;
  /** streamer noise frequency / scroll speed / seed */
  freq: number;
  scroll: number;
  seed: number;
  tint: string;
  gain: number;
  /** ray-independent base glow — keeps the rim smooth between streamers */
  base: number;
}

/** Three nested corona shells: hot tight rim -> long wispy streamers. */
const SHELLS: ShellSpec[] = [
  { radius: 1.18, power: 1.6, grow: 0.16, freq: 5.0, scroll: 0.06, seed: 3.7, tint: "#fff1cd", gain: 0.85, base: 0.3 },
  { radius: 1.45, power: 2.2, grow: 0.32, freq: 3.4, scroll: 0.042, seed: 11.3, tint: "#ffc070", gain: 0.5, base: 0.12 },
  { radius: 1.85, power: 3.0, grow: 0.55, freq: 2.4, scroll: 0.028, seed: 27.1, tint: "#ff7e3a", gain: 0.32, base: 0.07 },
];

const sunCenter = () => vec3(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z);

const makeUniforms = () => ({
  activity: uniform(DORMANT.coronaActivity),
  // per-shell |n·v| at the core limb — depends on the animated shell scale
  limbs: SHELLS.map((spec) => uniform(limbNdv(spec.radius))),
});
type StarUniforms = ReturnType<typeof makeUniforms>;

/** |n·v| where a shell of `ratio`×core grazes the core silhouette. */
function limbNdv(ratio: number): number {
  return Math.sqrt(Math.max(1e-6, 1 - 1 / (ratio * ratio)));
}

/**
 * Photosphere: granulation noise boiling slowly, limb-darkened toward a
 * deep orange rim. Emissive sits well above the bloom threshold so the
 * core blooms on its own; activity stokes it slightly brighter.
 */
function buildCoreMaterial(u: StarUniforms): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial();

  const n = positionWorld.sub(sunCenter()).normalize();
  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const facing = clamp(n.dot(viewDir), 0, 1);

  const granules = mx_fractal_noise_float(
    positionLocal.mul(1.6).add(time.mul(0.05)),
    4,
    2.2,
    0.55,
  )
    .mul(0.5)
    .add(0.5);

  // white-hot center -> orange limb, mottled by granulation
  const body = mix(
    color("#ff7a22"),
    color("#fff3d6"),
    facing.pow(0.65).mul(0.72).add(granules.mul(0.28)),
  );
  const boil = granules.mul(0.3).add(0.8);
  // above the 0.8 bloom threshold always, stoked by activity — but kept
  // tight so the bloom halo doesn't swallow the corona structure
  const heat = u.activity.mul(0.5).add(1.3);
  material.colorNode = vec4(body.mul(boil).mul(heat), 1);
  return material;
}

/**
 * Corona shell (BackSide, additive): only the annulus between the core limb
 * and the shell silhouette survives the core's depth test; brightness peaks
 * against the limb and decays outward, broken into slow boiling streamers.
 */
function buildShellMaterial(
  spec: ShellSpec,
  limb: StarUniforms["limbs"][number],
  u: StarUniforms,
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });

  const n = positionWorld.sub(sunCenter()).normalize();
  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const ndv = n.dot(viewDir);
  const halo = smoothstep(float(0), limb, ndv.abs()).pow(spec.power);

  // radial streamers: noise sampled on the view-projected radial direction —
  // constant along each screen-radial line, so the corona breaks into rays
  const spoke = n.sub(viewDir.mul(ndv)).normalize();
  const rays = mx_fractal_noise_float(
    spoke.mul(spec.freq).add(vec3(spec.seed, time.mul(spec.scroll), spec.seed * 0.31)),
    4,
    2.1,
    0.58,
  )
    .mul(0.5)
    .add(0.5);
  // fine isotropic boil so the rays shimmer instead of staying frozen
  const boil = mx_fractal_noise_float(
    n.mul(spec.freq * 2.6).sub(time.mul(spec.scroll * 1.7)),
    3,
    2.2,
    0.55,
  )
    .mul(0.5)
    .add(0.5);
  // activity sharpens ray contrast (turbulence) and feeds the brightness
  const streamers = rays.pow(u.activity.mul(1.3).add(1.3)).mul(boil.mul(0.45).add(0.55));

  const rgb = color(spec.tint).mul(1.7);
  material.colorNode = vec4(rgb, 1);
  material.opacityNode = halo
    .mul(streamers.mul(1.5).add(spec.base))
    .mul(u.activity.mul(1.0).add(0.25))
    .mul(spec.gain);
  return material;
}

/**
 * Instanced flare spikes: vertical-fin quads whose local +y points radially
 * outward from the star. Hue rides a per-instance attribute. Default count 0;
 * Task 13 feeds real workouts.
 */
function buildFlares() {
  const geometry = new THREE.PlaneGeometry(0.55, 2.4);
  geometry.translate(0, 1.2, 0); // pivot at the base (on the photosphere)

  const hueArray = new Float32Array(MAX_FLARES);
  const hueAttr = new THREE.InstancedBufferAttribute(hueArray, 1);

  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const hue = instancedBufferAttribute<"float">(hueAttr, "float");
  const cx = uv().x.sub(0.5).mul(2).abs();
  const tip = oneMinus(uv().y);
  // spike narrows toward the tip; soft horizontal falloff
  const width = tip.mul(0.8).add(0.14);
  const horiz = smoothstep(float(1), float(0.08), cx.div(width));
  const waver = mx_fractal_noise_float(
    vec3(uv().y.mul(2.6).sub(time.mul(0.5)), hue.mul(37.0), 4.2),
    3,
    2.0,
    0.55,
  )
    .mul(0.5)
    .add(0.5);
  const body = horiz.mul(tip.pow(1.6)).mul(waver.mul(0.55).add(0.45));

  material.colorNode = vec4(
    mix(color("#ffb35c"), color("#ff5ca8"), hue).mul(2.4),
    1,
  );
  material.opacityNode = body;

  const mesh = new THREE.InstancedMesh(geometry, material, MAX_FLARES);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return { mesh, hueAttr, geometry, material };
}

const UP = new THREE.Vector3(0, 1, 0);

export default function Star({
  world,
  flares = [],
}: {
  world: WorldState;
  flares?: Flare[];
}) {
  const activity = useRef(DORMANT.coronaActivity);
  const light = useRef<THREE.DirectionalLight>(null);
  const shellRefs = useRef<Array<THREE.Mesh | null>>([]);

  const { uniforms, core, shells, flareKit } = useMemo(() => {
    const u = makeUniforms();
    return {
      uniforms: u,
      core: buildCoreMaterial(u),
      shells: SHELLS.map((spec, i) => buildShellMaterial(spec, u.limbs[i], u)),
      flareKit: buildFlares(),
    };
  }, []);

  useEffect(
    () => () => {
      core.dispose();
      for (const m of shells) m.dispose();
      flareKit.material.dispose();
      flareKit.geometry.dispose();
      flareKit.mesh.dispose();
    },
    [core, shells, flareKit],
  );

  // (re)pose the instanced spikes whenever the flare list changes
  useEffect(() => {
    const m = new THREE.Matrix4();
    const radial = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const x = new THREE.Vector3();
    const count = Math.min(flares.length, MAX_FLARES);

    for (let i = 0; i < count; i += 1) {
      const f = flares[i];
      radial.set(Math.cos(f.angle), 0, Math.sin(f.angle));
      tangent.crossVectors(UP, radial); // unit: UP ⟂ radial
      const len = 0.45 + 1.1 * f.height;
      const wide = 0.6 + 0.5 * f.height;
      // vertical fin: local x → world up, local y → radial (spike direction)
      m.makeBasis(
        x.copy(UP).multiplyScalar(wide),
        radial.clone().multiplyScalar(len),
        tangent,
      );
      m.setPosition(
        radial.x * FLARE_BASE_RADIUS,
        0,
        radial.z * FLARE_BASE_RADIUS,
      );
      flareKit.mesh.setMatrixAt(i, m);
      flareKit.hueAttr.array[i] = f.hue ?? 0;
    }
    flareKit.mesh.count = count;
    flareKit.mesh.instanceMatrix.needsUpdate = true;
    flareKit.hueAttr.needsUpdate = true;
  }, [flares, flareKit]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    damp(activity, "current", world.coronaActivity, 1.8, dt);

    uniforms.activity.value = activity.current;
    for (let i = 0; i < SHELLS.length; i += 1) {
      const scale = 1 + SHELLS[i].grow * activity.current;
      shellRefs.current[i]?.scale.setScalar(scale);
      uniforms.limbs[i].value = limbNdv(SHELLS[i].radius * scale);
    }
    // the key light is the star itself — strain stokes it a touch
    if (light.current) light.current.intensity = 1.25 + 0.5 * activity.current;
  });

  return (
    <group position={SUN_POSITION}>
      {/* key light for the whole system; world target = origin (the planet) */}
      <directionalLight ref={light} intensity={1.4} color="#ffe9c9" />
      <mesh material={core}>
        <sphereGeometry args={[STAR_RADIUS, 48, 48]} />
      </mesh>
      {shells.map((material, i) => (
        <mesh
          key={SHELLS[i].seed}
          ref={(el) => {
            shellRefs.current[i] = el;
          }}
          material={material}
          renderOrder={1 + i}
        >
          <sphereGeometry args={[STAR_RADIUS * SHELLS[i].radius, 48, 48]} />
        </mesh>
      ))}
      <primitive object={flareKit.mesh} />
    </group>
  );
}
