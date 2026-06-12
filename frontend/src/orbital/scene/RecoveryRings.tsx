import { Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { color, uniform, vec4 } from "three/tsl";
import type { RingMetric } from "../worldState";

/**
 * Orbital baseline shells around the recovery planet (visible on /recovery).
 *
 * Each thin torus is one metric's personal baseline; a glowing marker rides
 * the ring, displaced perpendicular to the ring plane by the metric's
 * deviation vs baseline (clamped ±1.5σ × 0.25 world units). Physical offset
 * is the truth ("above the ring" = above baseline); colour carries the
 * semantics — RHR and resp invert, because below baseline is the good
 * direction for those.
 */

const RING_RADII = [2.4, 2.7, 3.0, 3.3] as const;
const TUBE_RADIUS = 0.012;
const HIT_TUBE_RADIUS = 0.1;
const MARKER_RADIUS = 0.052;
const OFFSET_SCALE = 0.25;
const Z_CLAMP = 1.5;
/** marker phase along each ring (rad) — staggered so they never overlap,
 * each chosen inside its ring's window that projects in-frame and unoccluded
 * for the /recovery camera ([0.5, 0.8, 4] → origin), validated by projecting
 * candidates through the live camera */
const MARKER_PHASES = [0.35, 5.85, 3.32, 5.62] as const;
/** per-ring plane tilt [x, z] — base ~35° with slight offsets so the stack
 * reads as nested orbital shells rather than a single flat disc */
const deg = THREE.MathUtils.degToRad;
const RING_TILTS = [
  [deg(33), deg(-6)],
  [deg(36), deg(-2)],
  [deg(38), deg(2)],
  [deg(41), deg(6)],
] as const;

const TEAL = new THREE.Color("#2ee6a8");
const ROSE = new THREE.Color("#ff5d7a");

const makeRingUniforms = () => ({
  hover: uniform(0),
  /** 1 = has value+baseline, eases toward 0.0 to dim a data-less ring */
  present: uniform(1),
  markerColor: uniform(TEAL.clone()),
});
type RingUniforms = ReturnType<typeof makeRingUniforms>;
type MasterUniform = RingUniforms["hover"];

/** Hairline additive teal; hover lifts brightness toward the bloom band. */
function buildRingMaterial(
  master: MasterUniform,
  u: RingUniforms,
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  material.colorNode = vec4(color(TEAL).mul(u.hover.mul(1.4).add(0.55)), 1);
  material.opacityNode = master
    .mul(u.present.mul(0.62).add(0.38))
    .mul(u.hover.mul(0.35).add(0.5));
  return material;
}

/** Small emissive sphere; ×2.4 puts it above the bloom threshold (0.8). */
function buildMarkerMaterial(
  master: MasterUniform,
  u: RingUniforms,
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true });
  material.colorNode = vec4(u.markerColor.mul(u.hover.mul(0.9).add(2.4)), 1);
  material.opacityNode = master;
  return material;
}

function chipText(m: RingMetric | undefined): string {
  if (!m) return "";
  if (m.value == null) return `${m.label} · no data`;
  const v = m.value.toFixed(m.decimals);
  const valueText = m.unit === "%" ? `${v}%` : `${v} ${m.unit}`;
  if (m.baselineMean == null || m.baselineSpread == null)
    return `${m.label} ${valueText} · no baseline`;
  return `${m.label} ${valueText} · baseline ${m.baselineMean.toFixed(
    m.decimals,
  )} ± ${m.baselineSpread.toFixed(m.decimals)}`;
}

export default function RecoveryRings({
  metrics,
  active,
}: {
  /** ring order = RING_RADII order (innermost first): HRV, RHR, resp, sleep */
  metrics: RingMetric[];
  /** route match — rings fade in on /recovery, fully hidden elsewhere */
  active: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const [hoveredRing, setHoveredRing] = useState<number | null>(null);

  // leaving the route mid-hover never fires pointerout — unstick the chip
  // (state adjusted during render, per react.dev "you might not need an effect")
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    setHoveredRing(null);
  }

  const { master, rings } = useMemo(() => {
    const masterOpacity = uniform(0);
    return {
      master: masterOpacity,
      rings: RING_RADII.map(() => {
        const u = makeRingUniforms();
        return {
          uniforms: u,
          ringMaterial: buildRingMaterial(masterOpacity, u),
          markerMaterial: buildMarkerMaterial(masterOpacity, u),
        };
      }),
    };
  }, []);

  useEffect(
    () => () => {
      for (const r of rings) {
        r.ringMaterial.dispose();
        r.markerMaterial.dispose();
      }
    },
    [rings],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    damp(master, "value", active ? 1 : 0, 0.35, dt);
    for (let i = 0; i < rings.length; i += 1) {
      const m = metrics[i];
      const u = rings[i].uniforms;
      damp(u.hover, "value", hoveredRing === i ? 1 : 0, 0.15, dt);
      damp(u.present, "value", m?.z != null ? 1 : 0, 0.4, dt);
      u.markerColor.value.set(m?.good === false ? ROSE : TEAL);
    }
    // fully faded → skip rendering entirely
    if (group.current) group.current.visible = active || master.value > 0.004;
  });

  return (
    <group ref={group} visible={false}>
      {RING_RADII.map((radius, i) => {
        const m = metrics[i];
        const phase = MARKER_PHASES[i];
        const z = m?.z ?? null;
        const offsetY =
          z == null ? 0 : THREE.MathUtils.clamp(z, -Z_CLAMP, Z_CLAMP) * OFFSET_SCALE;
        const markerPos: [number, number, number] = [
          radius * Math.cos(phase),
          offsetY,
          radius * Math.sin(phase),
        ];
        // handlers only exist while active — inactive rings never raycast
        const over = active
          ? (e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              setHoveredRing(i);
            }
          : undefined;
        const out = active
          ? () => setHoveredRing((cur) => (cur === i ? null : cur))
          : undefined;
        return (
          <group
            key={m?.key ?? i}
            rotation={[RING_TILTS[i][0], 0, RING_TILTS[i][1]]}
          >
            <mesh material={rings[i].ringMaterial} rotation-x={Math.PI / 2}>
              <torusGeometry args={[radius, TUBE_RADIUS, 8, 160]} />
            </mesh>
            {/* invisible fat torus = generous hover target (raycaster ignores `visible`) */}
            <mesh
              visible={false}
              rotation-x={Math.PI / 2}
              onPointerOver={over}
              onPointerOut={out}
            >
              <torusGeometry args={[radius, HIT_TUBE_RADIUS, 6, 48]} />
            </mesh>
            {z != null && (
              <>
                <mesh material={rings[i].markerMaterial} position={markerPos}>
                  <sphereGeometry args={[MARKER_RADIUS, 16, 16]} />
                </mesh>
                {/* marker can sit outside the hit torus — its own hit proxy */}
                <mesh
                  visible={false}
                  position={markerPos}
                  onPointerOver={over}
                  onPointerOut={out}
                >
                  <sphereGeometry args={[MARKER_RADIUS * 3, 8, 8]} />
                </mesh>
              </>
            )}
            {hoveredRing === i && active && (
              // chip anchor pulled toward the planet so the DOM label never
              // clips at the viewport edge (markers ride near the frame edges)
              <Html
                position={[markerPos[0] * 0.78, markerPos[1] + 0.3, markerPos[2] * 0.78]}
                center
                style={{ pointerEvents: "none" }}
                zIndexRange={[5, 0]}
              >
                <div className="orbital-chip">{chipText(m)}</div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
