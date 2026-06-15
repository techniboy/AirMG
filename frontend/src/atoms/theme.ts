import { atomWithStorage } from "jotai/utils";

export type Theme = "dark" | "liquid-glass" | "orbital" | "radio";

export const themeAtom = atomWithStorage<Theme>("airmg-theme", "radio");
