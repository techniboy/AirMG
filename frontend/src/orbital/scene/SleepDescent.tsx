import { Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { color, time, uniform, vec4, vertexColor } from "three/tsl";
import { sleepStageColor } from "../../lib/colors";
import type { StageSegment } from "../../lib/types";
import type { SleepTrack } from "../sleepData";

/**
 * Sleep diorama (/sleep): the night's hypnogram as an orbital descent track.
 *
 * Time maps to angle along a ~78° arc over the night-side hemisphere; sleep
 * stage maps to orbit altitude (deep = lowest orbit, hugging the planet).
 * One vertex-colored TubeGeometry through stage plateaus draws the whole
 * night in a single call; brief awakenings flash as rose "thruster burns".
 * Scrubbing the track glides a marker + clock/stage chip along the descent.
 *
 * Arc placement: the /sleep camera ([-2.6,0.6,3.4] → [-0.8,0,0]) sits ~4.3
 * units out, so the planned 2.3–3.4 radii could not all fit a 70° window in
 * frame (verified by projecting candidates through the camera — max joint
 * window was ~40°). Bands keep the spec order anchored at deep=2.3 but are
 * compressed to 0.25 spacing; the tilt below was grid-searched for the
 * widest unoccluded night-side window with the clearest on-screen band
 * separation (~102° available, 78° used).
 */

type Stage = StageSegment["stage"];

const deg = THREE.MathUtils.degToRad;
const ARC_TILT = new THREE.Euler(deg(-30), deg(40), deg(20));
const ARC_START = deg(178);
const ARC_END = deg(254);
const BAND_ALTITUDE: Record<Stage, number> = {
  wake: 3.05,
  rem: 2.8,
  light: 2.55,
  deep: 2.3,
};
const BAND_ORDER: Stage[] = ["wake", "rem", "light", "deep"];
const STAGE_LABEL: Record<Stage, string> = {
  wake: "AWAKE",
  rem: "REM",
  light: "LIGHT",
  deep: "DEEP",
};
/** chip text colour per stage — lifted toward white for dark-glass legibility */
const CHIP_COLOR: Record<Stage, string> = {
  wake: "#ff8ba6",
  rem: "#7df0da",
  light: "#a9b8f0",
  deep: "#8e9fe8",
};

const TRACK_RADIUS = 0.013;
const HIT_RADIUS = 0.16;
const RADIAL_SEGMENTS = 6;
const SCRUB_SAMPLES = 160;
const ROSE = new THREE.Color("#ff5d7a");

/** stage colours brightened (hue kept) so the additive track clears bloom */
const STAGE_GLOW: Record<Stage, THREE.Color> = (() => {
  const out = {} as Record<Stage, THREE.Color>;
  const hsl = { h: 0, s: 0, l: 0 };
  for (const stage of BAND_ORDER) {
    const c = new THREE.Color(sleepStageColor(stage));
    c.getHSL(hsl);
    c.setHSL(hsl.h, Math.min(1, hsl.s * 1.1), Math.max(hsl.l, 0.55));
    out[stage] = c;
  }
  return out;
})();

function arcPoint(
  frac: number,
  altitude: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const th = ARC_START + (ARC_END - ARC_START) * frac;
  return target
    .set(altitude * Math.cos(th), 0, altitude * Math.sin(th))
    .applyEuler(ARC_TILT);
}

/** constant-altitude ghost arc (band hairlines) */
class BandCurve extends THREE.Curve<THREE.Vector3> {
  private altitude: number;
  constructor(altitude: number) {
    super();
    this.altitude = altitude;
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return arcPoint(t, this.altitude, target);
  }
}

// band labels sit just before the arc start, static — computed once
const BAND_LABEL_POSITIONS = BAND_ORDER.map((stage) =>
  arcPoint(-0.025, BAND_ALTITUDE[stage]),
);

function stageAt(segments: StageSegment[], ts: number): Stage {
  for (const s of segments) if (ts < s.end) return s.stage;
  return segments[segments.length - 1].stage;
}

function fmtClock(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ScrubSample {
  pos: THREE.Vector3;
  ts: number;
  stage: Stage;
}

interface Built {
  curve: THREE.CatmullRomCurve3;
  trackGeometry: THREE.TubeGeometry;
  hitGeometry: THREE.TubeGeometry;
  bandGeometries: THREE.TubeGeometry[];
  samples: ScrubSample[];
  wakeMarkers: { ts: number; pos: THREE.Vector3 }[];
}

function buildTrack(track: SleepTrack): Built {
  const { segments, startTs, endTs } = track;
  const span = Math.max(1, endTs - startTs);

  // two waypoints per plateau (start + end at its band altitude) — the
  // centripetal Catmull-Rom turns each boundary into a soft step
  const pts: THREE.Vector3[] = [];
  const wpTimes: number[] = [];
  for (const s of segments) {
    const alt = BAND_ALTITUDE[s.stage];
    pts.push(arcPoint((s.start - startTs) / span, alt));
    wpTimes.push(s.start);
    pts.push(arcPoint((s.end - startTs) / span, alt));
    wpTimes.push(s.end);
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");

  const tubular = Math.min(Math.max(pts.length * 4, 96), 720);
  const trackGeometry = new THREE.TubeGeometry(
    curve,
    tubular,
    TRACK_RADIUS,
    RADIAL_SEGMENTS,
    false,
  );

  // arc-length row position → time → stage colour, per tube ring
  const timeAtU = (u: number): number => {
    const t = curve.getUtoTmapping(u, 0);
    const f = Math.min(t * (pts.length - 1), pts.length - 1.0001);
    const i0 = Math.floor(f);
    return wpTimes[i0] + (wpTimes[i0 + 1] - wpTimes[i0]) * (f - i0);
  };
  const ringSize = RADIAL_SEGMENTS + 1;
  const colors = new Float32Array(trackGeometry.attributes.position.count * 3);
  for (let i = 0; i <= tubular; i += 1) {
    const c = STAGE_GLOW[stageAt(segments, timeAtU(i / tubular))];
    for (let r = 0; r < ringSize; r += 1) {
      const o = (i * ringSize + r) * 3;
      colors[o] = c.r;
      colors[o + 1] = c.g;
      colors[o + 2] = c.b;
    }
  }
  trackGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const hitGeometry = new THREE.TubeGeometry(
    curve,
    Math.min(Math.max(pts.length * 2, 48), 240),
    HIT_RADIUS,
    RADIAL_SEGMENTS,
    false,
  );

  const bandGeometries = BAND_ORDER.map(
    (stage) =>
      new THREE.TubeGeometry(new BandCurve(BAND_ALTITUDE[stage]), 96, 0.011, 4, false),
  );

  const samples: ScrubSample[] = [];
  for (let i = 0; i <= SCRUB_SAMPLES; i += 1) {
    const u = i / SCRUB_SAMPLES;
    const ts = timeAtU(u);
    samples.push({
      pos: curve.getPointAt(u, new THREE.Vector3()),
      ts,
      stage: stageAt(segments, ts),
    });
  }

  const wakeMarkers = track.wakeEvents.map((ts) => ({
    ts,
    pos: arcPoint((ts - startTs) / span, BAND_ALTITUDE.wake),
  }));

  return { curve, trackGeometry, hitGeometry, bandGeometries, samples, wakeMarkers };
}

const tmpPoint = new THREE.Vector3();

export default function SleepDescent({
  track,
  active,
}: {
  /** decimated hypnogram for the control-center day; null = no session */
  track: SleepTrack | null;
  /** route match — track fades in on /sleep, fully hidden elsewhere */
  active: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const markerGroup = useRef<THREE.Group>(null);
  const [chip, setChip] = useState<{ text: string; stage: Stage } | null>(null);
  const hovering = useRef(false);
  const goalU = useRef(0.5);
  const scrubU = useRef({ value: 0.5 });

  // leaving the route mid-hover never fires pointerout — unstick the chip
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    setChip(null);
  }

  const built = useMemo(() => (track ? buildTrack(track) : null), [track]);

  // rebuild (day change) and unmount both release the old GPU buffers
  useEffect(() => {
    if (!built) return;
    return () => {
      built.trackGeometry.dispose();
      built.hitGeometry.dispose();
      for (const g of built.bandGeometries) g.dispose();
    };
  }, [built]);

  const { master, markerVis, markerColor, materials } = useMemo(() => {
    const masterOpacity = uniform(0);
    const markerOpacity = uniform(0);
    const mColor = uniform(new THREE.Color("#ffffff"));

    const trackMat = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    trackMat.vertexColors = true;
    trackMat.colorNode = vec4(vertexColor().xyz, 1);
    trackMat.opacityNode = masterOpacity.mul(0.92);

    // neutral faint hairline per band — a coloured shelf would read as a
    // (false) long stage plateau, so only the track carries stage colour
    const bandMats = BAND_ORDER.map(() => {
      const m = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      m.colorNode = vec4(color(new THREE.Color("#92a9dd")), 1);
      m.opacityNode = masterOpacity.mul(0.3);
      return m;
    });

    const markerMat = new THREE.MeshBasicNodeMaterial({ transparent: true });
    markerMat.colorNode = vec4(mColor.mul(2.4), 1);
    markerMat.opacityNode = masterOpacity.mul(markerOpacity);

    // slow shimmer keeps the wake "thruster burns" alive without a CPU loop
    const flashMat = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    flashMat.colorNode = vec4(
      color(ROSE).mul(time.mul(2.4).sin().mul(0.45).add(1.55)),
      1,
    );
    flashMat.opacityNode = masterOpacity.mul(0.85);

    return {
      master: masterOpacity,
      markerVis: markerOpacity,
      markerColor: mColor,
      materials: { trackMat, bandMats, markerMat, flashMat },
    };
  }, []);

  useEffect(
    () => () => {
      materials.trackMat.dispose();
      for (const m of materials.bandMats) m.dispose();
      materials.markerMat.dispose();
      materials.flashMat.dispose();
    },
    [materials],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    // leaving the route mid-hover never fires pointerout — unstick here
    if (!active) hovering.current = false;
    damp(master, "value", active ? 1 : 0, 0.35, dt);
    damp(markerVis, "value", hovering.current ? 1 : 0, 0.18, dt);
    if (built && markerGroup.current) {
      damp(scrubU.current, "value", goalU.current, 0.1, dt);
      const u = THREE.MathUtils.clamp(scrubU.current.value, 0, 1);
      built.curve.getPointAt(u, tmpPoint);
      markerGroup.current.position.copy(tmpPoint);
    }
    if (group.current) group.current.visible = active || master.value > 0.004;
  });

  // handlers only exist while active — inactive track never raycasts
  const onMove =
    active && built
      ? (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          const samples = built.samples;
          let best = 0;
          let bestD = Infinity;
          for (let i = 0; i < samples.length; i += 1) {
            const d2 = samples[i].pos.distanceToSquared(e.point);
            if (d2 < bestD) {
              bestD = d2;
              best = i;
            }
          }
          const s = samples[best];
          if (!hovering.current) {
            // first touch: snap the glide origin near the entry point
            scrubU.current.value = best / SCRUB_SAMPLES;
          }
          hovering.current = true;
          goalU.current = best / SCRUB_SAMPLES;
          markerColor.value.copy(STAGE_GLOW[s.stage]);
          const text = `${fmtClock(s.ts)} · ${STAGE_LABEL[s.stage]}`;
          setChip((prev) =>
            prev?.text === text ? prev : { text, stage: s.stage },
          );
        }
      : undefined;
  const onOut = active
    ? () => {
        hovering.current = false;
        setChip(null);
      }
    : undefined;

  if (!built) return null;

  return (
    <group ref={group} visible={false}>
      {/* band ghost hairlines — the four altitude shelves */}
      {built.bandGeometries.map((g, i) => (
        <mesh key={BAND_ORDER[i]} geometry={g} material={materials.bandMats[i]} />
      ))}
      {/* the descent track itself — one draw, vertex-colored by stage */}
      <mesh geometry={built.trackGeometry} material={materials.trackMat} />
      {/* brief awakenings — rose thruster burns on the wake band */}
      {built.wakeMarkers.map((w) => (
        <mesh key={w.ts} material={materials.flashMat} position={w.pos}>
          <sphereGeometry args={[0.022, 10, 10]} />
        </mesh>
      ))}
      {/* invisible fat tube = scrub surface (raycaster ignores `visible`) */}
      <mesh
        geometry={built.hitGeometry}
        visible={false}
        onPointerMove={onMove}
        onPointerOut={onOut}
      />
      {/* scrub marker glides along the curve; chip rides its world position */}
      <group ref={markerGroup}>
        <mesh material={materials.markerMat}>
          <sphereGeometry args={[0.045, 16, 16]} />
        </mesh>
        {chip && active && (
          <Html
            position={[0, 0.18, 0]}
            center
            style={{ pointerEvents: "none" }}
            zIndexRange={[5, 0]}
          >
            <div className="orbital-chip" style={{ color: CHIP_COLOR[chip.stage] }}>
              {chip.text}
            </div>
          </Html>
        )}
      </group>
      {active &&
        BAND_ORDER.map((stage, i) => (
          <Html
            key={stage}
            position={BAND_LABEL_POSITIONS[i]}
            center
            style={{ pointerEvents: "none" }}
            zIndexRange={[4, 0]}
          >
            <div
              className="orbital-chip orbital-chip--band"
              style={{ color: CHIP_COLOR[stage] }}
            >
              {STAGE_LABEL[stage]}
            </div>
          </Html>
        ))}
    </group>
  );
}
