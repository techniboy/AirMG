import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { instancedBufferAttribute, smoothstep, uv, vec4 } from "three/tsl";

/**
 * Three concentric star shells. Distant shells are denser and dimmer,
 * the near shell is sparse with bigger stars; each shell drifts at its
 * own rate around a slightly different axis for parallax.
 */
interface LayerSpec {
  count: number;
  radius: number;
  /** radians/second around local Y */
  spin: number;
  /** static tilt so the drift axes diverge */
  tilt: [number, number];
}

const LAYERS: LayerSpec[] = [
  { count: 3000, radius: 400, spin: 0.0032, tilt: [0.12, -0.05] },
  { count: 1500, radius: 250, spin: -0.0055, tilt: [-0.21, 0.09] },
  { count: 600, radius: 150, spin: 0.009, tilt: [0.3, -0.18] },
];

const COOL = new THREE.Color("#9db4ff");
const WARM = new THREE.Color("#ffc98a");
const WHITE = new THREE.Color("#ffffff");

function buildLayer(spec: LayerSpec): THREE.Sprite {
  const positions = new Float32Array(spec.count * 3);
  const colors = new Float32Array(spec.count * 3);
  const sizes = new Float32Array(spec.count);
  const c = new THREE.Color();

  for (let i = 0; i < spec.count; i += 1) {
    // uniform direction on the unit sphere, with shell-thickness jitter
    const y = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - y * y));
    const r = spec.radius * (0.86 + Math.random() * 0.28);
    positions[i * 3] = s * Math.cos(phi) * r;
    positions[i * 3 + 1] = y * r;
    positions[i * 3 + 2] = s * Math.sin(phi) * r;

    // cool whites dominate; a handful run warm
    const pick = Math.random();
    if (pick < 0.7) c.copy(WHITE).lerp(COOL, Math.random() * 0.55);
    else if (pick < 0.92) c.copy(WHITE);
    else c.copy(WHITE).lerp(WARM, 0.35 + Math.random() * 0.45);

    // mostly dim; ~8% hot stars bright enough to feed the bloom pass
    const intensity =
      Math.random() < 0.08
        ? 1.7 + Math.random() * 1.4
        : 0.5 + Math.random() * 0.9;
    colors[i * 3] = c.r * intensity;
    colors[i * 3 + 1] = c.g * intensity;
    colors[i * 3 + 2] = c.b * intensity;

    sizes[i] = 0.6 + Math.random();
  }

  const material = new THREE.PointsNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // WebGPU only rasterizes 1px point primitives, so stars render as
  // instanced camera-facing sprites with per-instance attributes.
  material.positionNode = instancedBufferAttribute<"vec3">(
    new THREE.InstancedBufferAttribute(positions, 3),
    "vec3",
  );
  material.sizeNode = instancedBufferAttribute<"float">(
    new THREE.InstancedBufferAttribute(sizes, 1),
    "float",
  );

  const starColor = instancedBufferAttribute<"vec3">(
    new THREE.InstancedBufferAttribute(colors, 3),
    "vec3",
  );
  // soft round falloff inside the quad: 1 at center, 0 at the rim
  const dist = uv().sub(0.5).length().mul(2);
  const falloff = smoothstep(1, 0, dist);
  material.colorNode = vec4(starColor.mul(falloff.mul(falloff)), 1);

  const sprite = new THREE.Sprite(material);
  sprite.count = spec.count;
  sprite.frustumCulled = false;
  sprite.rotation.set(spec.tilt[0], Math.random() * Math.PI * 2, spec.tilt[1]);
  return sprite;
}

export default function Starfield() {
  const layers = useMemo(() => LAYERS.map(buildLayer), []);
  const group = useRef<THREE.Group>(null);

  useEffect(
    () => () => {
      for (const layer of layers) layer.material.dispose();
    },
    [layers],
  );

  useFrame((_, delta) => {
    for (let i = 0; i < layers.length; i += 1) {
      layers[i].rotation.y += LAYERS[i].spin * delta;
    }
  });

  return (
    <group ref={group}>
      {layers.map((layer, i) => (
        <primitive key={i} object={layer} />
      ))}
    </group>
  );
}
