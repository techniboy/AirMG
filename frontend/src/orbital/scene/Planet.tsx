import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { damp, damp3 } from "maath/easing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import {
  atan,
  cameraPosition,
  clamp,
  color,
  cos,
  float,
  luminance,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalWorld,
  oneMinus,
  positionLocal,
  positionWorld,
  reflect,
  sin,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { RM } from "../perf";
import { DORMANT, type WorldState } from "../worldState";

/**
 * Where the star lives (see Star.tsx). Chosen so the sun reads upper-right
 * from the landing camera (fov 45 @ [0,1.2,9]) while keeping the planet's
 * crescent lit from the right.
 */
export const SUN_POSITION = new THREE.Vector3(22, 5, -36);
const SUN_DIR = SUN_POSITION.clone().normalize();

export const PLANET_RADIUS = 2;
const STORM_ALTITUDE = 2.06;

/** Deterministic storm slots in a low-latitude band (lat in radians). */
const STORM_SLOTS = [
  { lat: 0.18, lon: 0.4, size: 1.0, spin: 0.22, drift: 0.014 },
  { lat: -0.3, lon: 1.7, size: 0.82, spin: -0.18, drift: -0.01 },
  { lat: 0.05, lon: 2.9, size: 1.1, spin: 0.16, drift: 0.011 },
  { lat: -0.14, lon: 4.1, size: 0.74, spin: 0.26, drift: -0.012 },
  { lat: 0.34, lon: 5.2, size: 0.88, spin: -0.2, drift: 0.009 },
  { lat: -0.4, lon: 0.95, size: 0.7, spin: 0.19, drift: 0.015 },
];

const makeUniforms = () => ({
  saturation: uniform(DORMANT.surfaceSaturation),
  cityCalm: uniform(DORMANT.cityCalm),
  desaturate: uniform(DORMANT.desaturate),
  hover: uniform(0),
  sunDir: uniform(SUN_DIR.clone()),
  warmth: uniform(1),
});
type PlanetUniforms = ReturnType<typeof makeUniforms>;
type FloatUniform = PlanetUniforms["saturation"];

const sunDirNode = () => vec3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z);

/**
 * Texture-based Earth surface: real day albedo with an in-shader sea/land
 * mask, recovery grading (vivid -> desaturated), sun-terminator lighting,
 * ocean-only specular glint, time-of-day warmth tint, and night-side city
 * lights sampled from the real night texture.
 */
function buildSurfaceMaterial(
  u: PlanetUniforms,
  textures: { day: THREE.Texture; night: THREE.Texture },
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial();
  const sunDir = u.sunDir;

  // keep p for flicker
  const p = positionLocal.mul(0.85);

  // -- real Earth albedo --
  const dayTex = texture(textures.day, uv()).rgb;
  // ocean reads bluer than land — cheap sea mask, no extra asset
  const sea = smoothstep(0.0, 0.08, dayTex.b.sub(dayTex.r.max(dayTex.g)));
  const land = oneMinus(sea);

  // recovery grade: vivid albedo when recovered -> desaturated + dimmed when depleted
  const lum = luminance(dayTex);
  const graded = mix(vec3(lum).mul(0.55), dayTex, u.saturation.pow(1.2).mul(0.85).add(0.15));
  const surface = graded;

  // -- lighting vs the (future) star direction --
  const n = normalWorld.normalize();
  const ndl = n.dot(sunDir);
  const day = smoothstep(-0.06, 0.28, ndl);
  const duskBand = smoothstep(-0.07, 0.02, ndl).mul(smoothstep(0.18, 0.01, ndl));

  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const fresnel = oneMinus(clamp(n.dot(viewDir), 0, 1)).pow(3);
  const specDir = reflect(sunDir.negate(), n);
  const glint = clamp(specDir.dot(viewDir), 0, 1)
    .pow(64)
    .mul(sea)
    .mul(day)
    .mul(fresnel.mul(2.2).add(0.3));

  const dayWarm = mix(color("#ff9a5c"), color("#ffffff"), u.warmth);
  const lit = surface
    .mul(dayWarm)
    .mul(day.mul(u.warmth.mul(0.9).add(0.6)).add(0.018))
    .add(surface.mul(color("#33446e")).mul(oneMinus(day)).mul(0.32))
    .add(color("#ff9a5c").mul(duskBand).mul(0.022))
    .add(color("#e2f4ff").mul(glint).mul(0.85));

  // -- night-side city lights, from the real night texture (gated to land) --
  const cityMask = texture(textures.night, uv()).rgb.r.mul(land);
  const night = smoothstep(0.14, -0.2, ndl);

  // steady brightness scales with cityCalm; low-frequency flicker fills in when restless
  const flicker = mx_noise_float(p.mul(7).add(time.mul(0.45)))
    .mul(0.5)
    .add(0.5);
  const flickAmp = oneMinus(u.cityCalm).mul(0.75);
  const cityBrightness = mix(float(0.5), float(1), u.cityCalm).mul(
    oneMinus(flickAmp.mul(0.55)).add(flicker.mul(flickAmp)),
  );

  const withCities = lit.add(
    vec3(1.0, 0.58, 0.26).mul(3.2).mul(cityMask).mul(night).mul(cityBrightness),
  );

  // sync-stale wash toward grey
  const washed = mix(withCities, vec3(luminance(withCities)), u.desaturate);
  // hover glow: gentle overall lift so the planet reads as the active target
  const finalColor = washed.mul(u.hover.mul(0.22).add(1));
  material.colorNode = vec4(finalColor, 1);
  return material;
}

interface StormCell {
  pivot: THREE.Group;
  opacity: FloatUniform;
  drift: number;
  material: THREE.MeshBasicNodeMaterial;
  geometry: THREE.PlaneGeometry;
}

/** Additive swirl sprite: noise sampled in spiral-twisted polar coords. */
function buildStorm(slot: (typeof STORM_SLOTS)[number], seed: number): StormCell {
  const opacity = uniform(0);
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const centered = uv().sub(0.5).mul(2);
  const r = centered.length();
  const theta = atan(centered.y, centered.x);
  const swirl = theta.add(r.mul(6.5)).sub(time.mul(slot.spin));
  const sCoord = vec2(cos(swirl), sin(swirl)).mul(r);
  const cloud = mx_fractal_noise_float(
    vec3(sCoord.mul(2.4), float(seed * 17.31)),
    4,
    2.2,
    0.55,
  )
    .mul(0.5)
    .add(0.5);

  // soft rim, dimmed eye in the middle
  const body = smoothstep(1.0, 0.3, r).mul(smoothstep(0.0, 0.2, r).mul(0.85).add(0.15));
  // storms read mostly on the day side
  const stormDay = smoothstep(-0.05, 0.3, positionWorld.normalize().dot(sunDirNode()))
    .mul(0.85)
    .add(0.15);

  material.colorNode = vec4(vec3(0.82, 0.88, 0.97).mul(stormDay).mul(1.35), 1);
  material.opacityNode = cloud.mul(cloud).mul(body).mul(opacity);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  const dir = new THREE.Vector3(
    Math.cos(slot.lat) * Math.cos(slot.lon),
    Math.sin(slot.lat),
    Math.cos(slot.lat) * Math.sin(slot.lon),
  );
  mesh.position.copy(dir).multiplyScalar(STORM_ALTITUDE);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  mesh.scale.setScalar(slot.size);
  mesh.renderOrder = 2;

  const pivot = new THREE.Group();
  pivot.add(mesh);
  return { pivot, opacity, drift: slot.drift, material, geometry };
}

export default function Planet({
  world,
  sunDir,
  warmth,
  onSelect,
  hovered = false,
}: {
  world: WorldState;
  sunDir: [number, number, number];
  warmth: number;
  onSelect?: () => void;
  /** external highlight (HUD panel hover) — treated like pointer hover */
  hovered?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  // start from the dormant pose and ease awake on first data
  const rotSpeed = useRef(DORMANT.rotationSpeed);
  const stormAnim = useRef(0);
  const [pointerHover, setPointerHover] = useState(false);
  const hot = hovered || pointerHover;

  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const day = loader.load("/orbital/earth-day.jpg");
    const night = loader.load("/orbital/earth-night.jpg");
    day.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    day.anisotropy = 4;
    return { day, night };
  }, []);

  const sunTarget = useMemo(() => new THREE.Vector3(), []);

  const { material, uniforms, storms } = useMemo(() => {
    const u = makeUniforms();
    return {
      material: buildSurfaceMaterial(u, textures),
      uniforms: u,
      storms: STORM_SLOTS.map((slot, i) => buildStorm(slot, i + 1)),
    };
  }, [textures]);

  useEffect(
    () => () => {
      material.dispose();
      textures.day.dispose();
      textures.night.dispose();
      for (const s of storms) {
        s.material.dispose();
        s.geometry.dispose();
      }
    },
    [material, storms, textures],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    damp(uniforms.saturation, "value", world.surfaceSaturation, 2, dt);
    damp(uniforms.cityCalm, "value", world.cityCalm, 2, dt);
    damp(uniforms.desaturate, "value", world.desaturate, 1.5, dt);
    damp(rotSpeed, "current", world.rotationSpeed, 1.8, dt);
    damp(stormAnim, "current", world.stormCount, 2.5, dt);
    // glow only — no scale boost: the atmosphere shell sits at 1.028×R and
    // the aurora at 1.012×R, so a 1.04 scale would poke through both
    damp(uniforms.hover, "value", hot ? 1 : 0, 0.18, dt);

    sunTarget.set(sunDir[0], sunDir[1], sunDir[2]);
    damp3(uniforms.sunDir.value, sunTarget, 3, dt);
    damp(uniforms.warmth, "value", warmth, 3, dt);

    const DRIFT = 0.12; // RHR rotation scaled to ~1 turn / 30+ min so the terminator reads
    if (group.current) group.current.rotation.y += rotSpeed.current * DRIFT * dt * RM;
    for (let i = 0; i < storms.length; i += 1) {
      storms[i].opacity.value = THREE.MathUtils.clamp(stormAnim.current - i, 0, 1);
      storms[i].pivot.rotation.y += storms[i].drift * dt * RM;
    }
  });

  return (
    <group>
      <group ref={group}>
        <mesh
          material={material}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setPointerHover(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setPointerHover(false);
            document.body.style.cursor = "";
          }}
        >
          <sphereGeometry args={[PLANET_RADIUS, 64, 64]} />
        </mesh>
        {storms.map((storm, i) => (
          <primitive key={i} object={storm.pivot} />
        ))}
      </group>
      {hot && (
        <Html
          position={[0, PLANET_RADIUS + 0.65, 0]}
          center
          style={{ pointerEvents: "none" }}
          zIndexRange={[5, 0]}
        >
          <div className="orbital-chip">Recovery · Planet</div>
        </Html>
      )}
    </group>
  );
}
