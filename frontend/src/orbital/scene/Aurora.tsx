import { useFrame } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import {
  clamp,
  color,
  float,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalLocal,
  oneMinus,
  positionLocal,
  smoothstep,
  time,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { RM } from "../perf";
import { DORMANT, type WorldState } from "../worldState";
import { PLANET_RADIUS } from "./Planet";

const BASE_ALTITUDE = PLANET_RADIUS * 1.012;

interface RibbonSpec {
  /** mean latitude of the base curve, degrees */
  latDeg: number;
  /** latitude wobble amplitude, degrees */
  latAmpDeg: number;
  /** how many wobble periods along the arc */
  waves: number;
  /** arc start longitude + span, radians */
  lonStart: number;
  span: number;
  /** curtain height above the base curve */
  height: number;
  phase: number;
  seed: number;
  /** slow individual drift around the pole, rad/s */
  drift: number;
}

/** Three nested curtains in the auroral oval band (lat ~55-75 deg). */
const RIBBONS: RibbonSpec[] = [
  { latDeg: 63, latAmpDeg: 6.5, waves: 2.6, lonStart: 0.6, span: 3.4, height: 0.78, phase: 0.0, seed: 3.1, drift: 0.011 },
  { latDeg: 70, latAmpDeg: 4.5, waves: 3.4, lonStart: 2.9, span: 2.7, height: 0.6, phase: 1.7, seed: 7.7, drift: -0.008 },
  { latDeg: 57, latAmpDeg: 5.0, waves: 2.1, lonStart: 4.6, span: 2.9, height: 0.68, phase: 3.9, seed: 12.3, drift: 0.006 },
];

const SEGS_X = 180;
const SEGS_Y = 24;

/**
 * Curved vertical strip: base follows a wavy ring arc at the given latitude,
 * top extends radially outward. uv.x runs along the arc, uv.y up the curtain.
 * Vertex normals (perpendicular to the strip) become the sway direction.
 */
function buildRibbonGeometry(spec: RibbonSpec): THREE.BufferGeometry {
  const positions = new Float32Array((SEGS_X + 1) * (SEGS_Y + 1) * 3);
  const uvs = new Float32Array((SEGS_X + 1) * (SEGS_Y + 1) * 2);
  const indices: number[] = [];
  const dir = new THREE.Vector3();

  for (let iy = 0; iy <= SEGS_Y; iy += 1) {
    const t = iy / SEGS_Y;
    for (let ix = 0; ix <= SEGS_X; ix += 1) {
      const s = ix / SEGS_X;
      const lat = THREE.MathUtils.degToRad(
        spec.latDeg +
          spec.latAmpDeg * Math.sin(s * spec.waves * Math.PI * 2 + spec.phase),
      );
      const lon = spec.lonStart + s * spec.span;
      dir.set(
        Math.cos(lat) * Math.cos(lon),
        Math.sin(lat),
        Math.cos(lat) * Math.sin(lon),
      );
      // gentle height undulation so the top edge isn't a clean parallel curve
      const crest = 1 + 0.22 * Math.sin(s * 5.3 + spec.phase * 2.1);
      const radius = BASE_ALTITUDE + t * spec.height * crest;
      const v = iy * (SEGS_X + 1) + ix;
      positions[v * 3] = dir.x * radius;
      positions[v * 3 + 1] = dir.y * radius;
      positions[v * 3 + 2] = dir.z * radius;
      uvs[v * 2] = s;
      uvs[v * 2 + 1] = t;
    }
  }
  for (let iy = 0; iy < SEGS_Y; iy += 1) {
    for (let ix = 0; ix < SEGS_X; ix += 1) {
      const a = iy * (SEGS_X + 1) + ix;
      const b = a + 1;
      const c = a + (SEGS_X + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const makeUniforms = () => ({
  intensity: uniform(DORMANT.auroraIntensity),
  recovery01: uniform(DORMANT.recovery01),
});
type AuroraUniforms = ReturnType<typeof makeUniforms>;

// 5-stop recovery palette (matches src/index.css --color-recovery-*)
const RECOVERY_STOPS = [
  color("#FF4F73"), // depleted
  color("#F5A623"), // low
  color("#E8C24B"), // moderate
  color("#18C98B"), // primed
  color("#2FE6A8"), // peak
];

/** Piecewise-linear lerp across the 5 stops, keyed on a 0..1 node. */
function recoveryRamp(t01: AuroraUniforms["recovery01"]) {
  const seg = t01.mul(4);
  const f = (lo: number) => clamp(seg.sub(lo), 0, 1);
  return mix(
    mix(mix(mix(RECOVERY_STOPS[0], RECOVERY_STOPS[1], f(0)), RECOVERY_STOPS[2], f(1)), RECOVERY_STOPS[3], f(2)),
    RECOVERY_STOPS[4],
    f(3),
  );
}

/**
 * Curtain shading: slow lateral sway in the vertex stage; in the fragment
 * stage a bright base fading upward, cut by layered scrolling striations
 * (the vertical rays), tinted by recovery state (red depleted → mint peak).
 */
function buildRibbonMaterial(
  spec: RibbonSpec,
  u: AuroraUniforms,
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const s = uv().x;
  const t = uv().y;
  const seed = float(spec.seed);

  // -- vertex: slow majestic sway, growing with height so the base stays pinned
  const sway = mx_fractal_noise_float(
    vec3(s.mul(3.2).add(seed), time.mul(0.045 * RM).add(spec.phase), seed.mul(0.37)),
    2,
    2.0,
    0.55,
  )
    .mul(t.mul(t).mul(0.22).add(t.mul(0.03)));
  material.positionNode = positionLocal.add(normalLocal.mul(sway));

  // -- fragment: curtain striations (tall thin rays, two scales, drifting)
  const ray1 = mx_fractal_noise_float(
    vec3(s.mul(24).add(seed), t.mul(1.3), time.mul(0.03 * RM).add(spec.phase)),
    3,
    2.1,
    0.6,
  )
    .mul(0.5)
    .add(0.5);
  const ray2 = mx_noise_float(
    vec3(s.mul(52).sub(time.mul(0.02 * RM)), t.mul(0.55), seed.mul(1.93)),
  )
    .mul(0.5)
    .add(0.5);
  const striae = ray1.mul(ray2.mul(0.65).add(0.35)).pow(1.6);

  // vertical profile: hot lower edge, long fade to the tip
  const lift = smoothstep(0.0, 0.045, t);
  const fadeUp = oneMinus(t).pow(1.55);
  const baseGlow = oneMinus(t).pow(7).mul(0.85);
  const arcFade = smoothstep(0.0, 0.09, s).mul(smoothstep(1.0, 0.91, s));
  const body = lift
    .mul(fadeUp)
    .mul(striae)
    .mul(1.45)
    .add(baseGlow.mul(striae.mul(0.5).add(0.35)))
    .mul(arcFade);

  // hue follows recovery (red depleted -> mint peak); tip rides a touch brighter
  const baseColor = recoveryRamp(u.recovery01);
  const tipColor = baseColor.mul(1.18).add(vec3(0.02, 0.05, 0.07));
  const rgb = mix(baseColor, tipColor, smoothstep(0.3, 1.0, t).mul(0.65)).mul(1.8);

  material.colorNode = vec4(rgb, 1);
  material.opacityNode = body.mul(u.intensity).mul(1.1);
  return material;
}

interface Curtain {
  pivot: THREE.Group;
  drift: number;
  material: THREE.MeshBasicNodeMaterial;
  geometry: THREE.BufferGeometry;
}

function buildCurtain(spec: RibbonSpec, u: AuroraUniforms): Curtain {
  const geometry = buildRibbonGeometry(spec);
  const material = buildRibbonMaterial(spec, u);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  const pivot = new THREE.Group();
  pivot.add(mesh);
  return { pivot, drift: spec.drift, material, geometry };
}

export default function Aurora({ world }: { world: WorldState }) {
  const group = useRef<THREE.Group>(null);

  const { uniforms, curtains } = useMemo(() => {
    const u = makeUniforms();
    return { uniforms: u, curtains: RIBBONS.map((spec) => buildCurtain(spec, u)) };
  }, []);

  useEffect(
    () => () => {
      for (const c of curtains) {
        c.material.dispose();
        c.geometry.dispose();
      }
    },
    [curtains],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    damp(uniforms.intensity, "value", world.auroraIntensity, 2.2, dt);
    damp(uniforms.recovery01, "value", world.recovery01, 2.2, dt);

    // the oval slips against the surface rotation — magnetosphere, not crust
    if (group.current) group.current.rotation.y -= 0.012 * dt * RM;
    for (const c of curtains) c.pivot.rotation.y += c.drift * dt * RM;
  });

  return (
    <group ref={group}>
      {curtains.map((c, i) => (
        <primitive key={i} object={c.pivot} />
      ))}
    </group>
  );
}
