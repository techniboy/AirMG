import { useFrame } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
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
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { DORMANT, type WorldState } from "../worldState";

/** The star lives here from Task 8 onward; light the planet from it now. */
export const SUN_POSITION = new THREE.Vector3(38, 6, -20);
const SUN_DIR = SUN_POSITION.clone().normalize();

const PLANET_RADIUS = 2;
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
});
type PlanetUniforms = ReturnType<typeof makeUniforms>;
type FloatUniform = PlanetUniforms["saturation"];

const sunDirNode = () => vec3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z);

/**
 * Procedural surface: domain-warped fbm continents over a deep teal ocean,
 * sun-lit with a soft terminator, ocean-only specular glint, polar caps,
 * and amber city clusters that only read on the night side.
 */
function buildSurfaceMaterial(u: PlanetUniforms): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial();
  const sunDir = sunDirNode();

  // -- terrain field (object space so it rotates with the planet) --
  const p = positionLocal.mul(0.85);
  const warp = vec3(
    mx_noise_float(p.mul(1.3).add(vec3(13.7, 0, 0))),
    mx_noise_float(p.mul(1.3).add(vec3(0, 7.31, 0))),
    mx_noise_float(p.mul(1.3).add(vec3(0, 0, 23.1))),
  ).mul(0.38);
  const h = mx_fractal_noise_float(p.add(warp), 5, 2.07, 0.54);
  const landMask = smoothstep(0.045, 0.17, h);
  const detail = mx_fractal_noise_float(p.mul(3.6).add(11.0), 4, 2.2, 0.55)
    .mul(0.5)
    .add(0.5);

  // -- palette --
  const depth = smoothstep(-0.38, 0.045, h);
  const oceanLush = mix(color("#04222e"), color("#0a4f63"), depth);
  const oceanAshen = mix(color("#1d262e"), color("#3a464e"), depth);
  const ocean = mix(oceanAshen, oceanLush, u.saturation.mul(0.8).add(0.2));

  const lush = mix(color("#135c41"), color("#3f9a60"), detail);
  const ashen = mix(color("#43464b"), color("#82868a"), detail);
  // power-curve so mid recovery reads clearly between lush and ashen
  const land = mix(ashen, lush, u.saturation.pow(1.5));

  const pole = positionLocal.normalize().y.abs();
  const ice = smoothstep(0.84, 0.92, pole.add(detail.mul(0.05)));
  const surface = mix(mix(ocean, land, landMask), color("#bcd2e0"), ice);

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
    .mul(oneMinus(landMask))
    .mul(oneMinus(ice))
    .mul(day)
    .mul(fresnel.mul(2.2).add(0.3));

  const lit = surface
    .mul(day.mul(1.5).add(0.018))
    .add(surface.mul(color("#33446e")).mul(oneMinus(day)).mul(0.32))
    .add(color("#ff9a5c").mul(duskBand).mul(0.022))
    .add(color("#e2f4ff").mul(glint).mul(0.85));

  // -- night-side city lights --
  const clusters = smoothstep(
    0.02,
    0.5,
    mx_fractal_noise_float(p.mul(2.4).add(31.7), 3, 2.0, 0.55),
  );
  const dots = smoothstep(
    0.52,
    0.95,
    mx_fractal_noise_float(p.mul(21.0).add(5.2), 3, 2.3, 0.6),
  );
  const night = smoothstep(0.14, -0.2, ndl);
  const cityMask = dots.mul(clusters).mul(landMask).mul(oneMinus(ice));

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
  const finalColor = mix(withCities, vec3(luminance(withCities)), u.desaturate);
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

export default function Planet({ world }: { world: WorldState }) {
  const group = useRef<THREE.Group>(null);
  // start from the dormant pose and ease awake on first data
  const rotSpeed = useRef(DORMANT.rotationSpeed);
  const stormAnim = useRef(0);

  const { material, uniforms, storms } = useMemo(() => {
    const u = makeUniforms();
    return {
      material: buildSurfaceMaterial(u),
      uniforms: u,
      storms: STORM_SLOTS.map((slot, i) => buildStorm(slot, i + 1)),
    };
  }, []);

  useEffect(
    () => () => {
      material.dispose();
      for (const s of storms) {
        s.material.dispose();
        s.geometry.dispose();
      }
    },
    [material, storms],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    damp(uniforms.saturation, "value", world.surfaceSaturation, 2, dt);
    damp(uniforms.cityCalm, "value", world.cityCalm, 2, dt);
    damp(uniforms.desaturate, "value", world.desaturate, 1.5, dt);
    damp(rotSpeed, "current", world.rotationSpeed, 1.8, dt);
    damp(stormAnim, "current", world.stormCount, 2.5, dt);

    if (group.current) group.current.rotation.y += rotSpeed.current * dt;
    for (let i = 0; i < storms.length; i += 1) {
      storms[i].opacity.value = THREE.MathUtils.clamp(stormAnim.current - i, 0, 1);
      storms[i].pivot.rotation.y += storms[i].drift * dt;
    }
  });

  return (
    <group ref={group}>
      <mesh material={material}>
        <sphereGeometry args={[PLANET_RADIUS, 64, 64]} />
      </mesh>
      {storms.map((storm, i) => (
        <primitive key={i} object={storm.pivot} />
      ))}
    </group>
  );
}
