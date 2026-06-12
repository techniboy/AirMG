import { useFrame, useThree } from "@react-three/fiber";
import { damp3 } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { SUN_POSITION } from "./scene/Planet";

export interface CameraTarget {
  pos: [number, number, number];
  look: [number, number, number];
}

/** Hero framings per route; anything else pulls back to the console shot. */
export const CAMERA_TARGETS: Record<string, CameraTarget> = {
  "/": { pos: [0, 1.2, 9], look: [0, 0, 0] },
  "/recovery": { pos: [0.5, 0.8, 4], look: [0, 0, 0] },
  "/sleep": { pos: [-2.6, 0.6, 3.4], look: [-0.8, 0, 0] },
  "/strain": {
    pos: [8, 2, -13],
    look: [SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z],
  },
};

export const CONSOLE_TARGET: CameraTarget = { pos: [0, 2.2, 11], look: [0, 0, 0] };

export function targetForPath(pathname: string): CameraTarget {
  return CAMERA_TARGETS[pathname] ?? CONSOLE_TARGET;
}

// smoothTime ≈ time to cover ~90% of the distance; ~0.45 settles in ≈1.2s
const POS_SMOOTH = 0.45;
const LOOK_SMOOTH = 0.4;
const PARALLAX_SMOOTH = 0.6;
const PARALLAX_POS = 0.15; // world units at pointer extremes
const PARALLAX_LOOK = 0.22;

/**
 * Cinematic camera rig. Lives inside the Canvas; the route arrives as a prop
 * because the router context only exists in the DOM React root.
 *
 * Both the position and a lookAt proxy are damped (critically-damped spring
 * via maath), so retargeting mid-flight is interruption-safe by construction:
 * a new route just swaps the goal and the spring bends toward it. Mouse
 * parallax rides on top as a separately-damped offset. Under
 * `prefers-reduced-motion` everything snaps.
 */
export default function CameraRig({ pathname }: { pathname: string }) {
  const camera = useThree((s) => s.camera);
  const pointer = useThree((s) => s.pointer);

  const targetRef = useRef(targetForPath(pathname));
  useEffect(() => {
    targetRef.current = targetForPath(pathname);
  }, [pathname]);

  const reducedMotion = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const v = useMemo(
    () => ({
      basePos: new THREE.Vector3().copy(camera.position),
      look: new THREE.Vector3(...targetForPath(pathname).look),
      parallax: new THREE.Vector3(),
      parallaxGoal: new THREE.Vector3(),
      lookOffset: new THREE.Vector3(),
      lookOffsetGoal: new THREE.Vector3(),
      finalLook: new THREE.Vector3(),
    }),
    // intentionally captured once at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const t = targetRef.current;

    if (reducedMotion.current) {
      v.basePos.set(t.pos[0], t.pos[1], t.pos[2]);
      v.look.set(t.look[0], t.look[1], t.look[2]);
      v.parallax.set(0, 0, 0);
      v.lookOffset.set(0, 0, 0);
    } else {
      damp3(v.basePos, t.pos, POS_SMOOTH, dt);
      damp3(v.look, t.look, LOOK_SMOOTH, dt);
      v.parallaxGoal.set(pointer.x * PARALLAX_POS, pointer.y * PARALLAX_POS, 0);
      damp3(v.parallax, v.parallaxGoal, PARALLAX_SMOOTH, dt);
      v.lookOffsetGoal.set(
        pointer.x * PARALLAX_LOOK,
        pointer.y * PARALLAX_LOOK,
        0,
      );
      damp3(v.lookOffset, v.lookOffsetGoal, PARALLAX_SMOOTH, dt);
    }

    camera.position.copy(v.basePos).add(v.parallax);
    camera.lookAt(v.finalLook.copy(v.look).add(v.lookOffset));
  });

  return null;
}
