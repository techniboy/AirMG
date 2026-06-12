import { atom } from "jotai";

/** Which celestial body the HUD wants highlighted (panel hover → scene). */
export type HoveredObject = "planet" | "moon" | "star" | null;

export const hoveredObjectAtom = atom<HoveredObject>(null);
