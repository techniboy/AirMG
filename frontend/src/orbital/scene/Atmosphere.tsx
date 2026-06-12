import { useFrame } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import {
  cameraPosition,
  clamp,
  color,
  mix,
  oneMinus,
  positionWorld,
  smoothstep,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import { DORMANT, type WorldState } from "../worldState";
import { PLANET_RADIUS, SUN_POSITION } from "./Planet";

const SUN_DIR = SUN_POSITION.clone().normalize();

/** Thin haze film hugging the surface — gives the limb its bright inner edge. */
const INNER_RADIUS = PLANET_RADIUS * 1.028;
/** Back-side halo shell — the scattering glow that bleeds past the limb. */
const OUTER_RADIUS = PLANET_RADIUS * 1.105;
/**
 * On the BackSide shell only the annulus between the planet limb and the
 * shell silhouette survives the depth test; |n·v| spans [0..LIMB_NDV] there
 * (0 at the silhouette, max where the shell grazes the planet limb).
 */
const LIMB_NDV = Math.sqrt(1 - (PLANET_RADIUS / OUTER_RADIUS) ** 2);

const makeUniforms = () => ({
  density: uniform(DORMANT.atmosphereDensity),
  hue: uniform(DORMANT.atmosphereHue),
});
type AtmosphereUniforms = ReturnType<typeof makeUniforms>;

const sunDirNode = () => vec3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z);

/**
 * Shared shading terms: view/sun geometry + the density-driven palette.
 * The outward normal comes from positionWorld (shells are origin-centered
 * spheres) — attribute normals get flipped on BackSide faces, which would
 * mirror the sun term to the wrong limb.
 */
function sharedTerms(u: AtmosphereUniforms) {
  const n = positionWorld.normalize();
  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const ndv = n.dot(viewDir);
  const ndl = n.dot(sunDirNode());
  // light wraps a little past the terminator so the night limb keeps a whisper
  const dayWrap = smoothstep(-0.45, 0.4, ndl);
  // grey-blue exhaustion -> deep healthy teal
  const baseColor = mix(color("#6b7d96"), color("#2ee6a8"), u.hue);
  // forward scatter near the star runs warmer (sunrise rim)
  const sunGlow = clamp(ndl, 0, 1).pow(2.2);
  return { ndv, dayWrap, baseColor, sunGlow };
}

/**
 * Inner film (FrontSide): classic fresnel so the brightening lives only at
 * grazing angles — the disc center must stay completely clean.
 */
function buildInnerMaterial(u: AtmosphereUniforms): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const { ndv, dayWrap, baseColor, sunGlow } = sharedTerms(u);

  const fresnel = oneMinus(clamp(ndv, 0, 1)).pow(4.2);
  const warm = color("#ffd9a8").mul(sunGlow.mul(fresnel).mul(1.25));
  const rgb = baseColor
    .mul(dayWrap.mul(1.3).add(0.07))
    .add(warm)
    .mul(1.55);

  material.colorNode = vec4(rgb, 1);
  material.opacityNode = fresnel.mul(dayWrap.mul(0.75).add(0.25)).mul(u.density);
  return material;
}

/**
 * Outer halo (BackSide): glow is brightest against the planet limb and decays
 * outward to nothing at the shell silhouette — reads as volumetric falloff.
 */
function buildOuterMaterial(u: AtmosphereUniforms): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const { ndv, dayWrap, baseColor, sunGlow } = sharedTerms(u);

  // |n·v| == LIMB_NDV right at the planet limb, 0 at the halo's outer edge
  const limb = smoothstep(0, LIMB_NDV, ndv.abs()).pow(1.7);
  const warm = color("#ffc890").mul(sunGlow.mul(limb).mul(1.05));
  const rgb = baseColor
    .mul(dayWrap.mul(1.35).add(0.06))
    .add(warm)
    .mul(1.5);

  material.colorNode = vec4(rgb, 1);
  material.opacityNode = limb.mul(dayWrap.mul(0.92).add(0.08)).mul(u.density);
  return material;
}

export default function Atmosphere({ world }: { world: WorldState }) {
  const { uniforms, inner, outer } = useMemo(() => {
    const u = makeUniforms();
    return {
      uniforms: u,
      inner: buildInnerMaterial(u),
      outer: buildOuterMaterial(u),
    };
  }, []);

  useEffect(
    () => () => {
      inner.dispose();
      outer.dispose();
    },
    [inner, outer],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    damp(uniforms.density, "value", world.atmosphereDensity, 2, dt);
    damp(uniforms.hue, "value", world.atmosphereHue, 2, dt);
  });

  return (
    <group>
      <mesh material={inner} renderOrder={1}>
        <sphereGeometry args={[INNER_RADIUS, 64, 64]} />
      </mesh>
      <mesh material={outer} renderOrder={1}>
        <sphereGeometry args={[OUTER_RADIUS, 64, 64]} />
      </mesh>
    </group>
  );
}
