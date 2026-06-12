import { atomWithStorage } from "jotai/utils";

export type Theme = "dark" | "liquid-glass";

export const themeAtom = atomWithStorage<Theme>("airmg-theme", "dark");
