import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import {
  convertToTexture,
  float,
  fract,
  pass,
  rand,
  renderOutput,
  time,
  uv,
  vec4,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

const BLOOM_STRENGTH = 0.6;
const BLOOM_RADIUS = 0.4;
const BLOOM_THRESHOLD = 0.8;
const VIGNETTE_STRENGTH = 0.9;
const GRAIN_AMOUNT = 0.035;
const CA_AMOUNT = 0.0015;

export interface EffectsProps {
  quality: "high" | "low";
}

/**
 * three-native post chain (RenderPipeline + TSL):
 * scene pass -> bloom -> ACES filmic tonemap -> vignette -> film grain
 * -> edge chromatic aberration. `quality="low"` keeps the tonemap only.
 */
export default function Effects({ quality }: EffectsProps) {
  const renderer = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const post = useMemo(() => {
    // "PostProcessing" was renamed to "RenderPipeline" in r184
    const fx = new THREE.RenderPipeline(renderer);
    // tone mapping is placed explicitly mid-chain via renderOutput()
    fx.outputColorTransform = false;

    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode("output");
    const disposables: Array<{ dispose: () => void }> = [scenePass, fx];

    if (quality === "low") {
      fx.outputNode = renderOutput(
        color,
        THREE.ACESFilmicToneMapping,
        THREE.SRGBColorSpace,
      );
      return { fx, disposables };
    }

    const bloomPass = bloom(color, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD);
    disposables.push(bloomPass);
    const tonemapped = renderOutput(
      color.add(bloomPass),
      THREE.ACESFilmicToneMapping,
      THREE.SRGBColorSpace,
    );

    // vignette: quadratic darkening toward the corners
    const offCenter = uv().sub(0.5);
    const vignette = float(1)
      .sub(offCenter.length().pow(2).mul(VIGNETTE_STRENGTH))
      .clamp(0, 1);

    // zero-mean animated film grain (post-tonemap, so it reads in sRGB)
    const grain = rand(fract(uv().add(time))).sub(0.5).mul(GRAIN_AMOUNT);

    const graded = vec4(tonemapped.rgb.mul(vignette).add(grain), 1);

    // very subtle chromatic aberration, growing quadratically toward edges
    const composed = convertToTexture(graded);
    disposables.push(composed);
    const shift = offCenter.mul(offCenter.length()).mul(CA_AMOUNT * 2);
    fx.outputNode = vec4(
      composed.sample(uv().add(shift)).r,
      composed.sample(uv()).g,
      composed.sample(uv().sub(shift)).b,
      1,
    );

    return { fx, disposables };
  }, [renderer, scene, camera, quality]);

  useEffect(
    () => () => {
      for (const node of post.disposables) node.dispose();
    },
    [post],
  );

  // priority > 0 takes over r3f's render loop so the post chain drives output
  useFrame(() => post.fx.render(), 1);

  return null;
}
