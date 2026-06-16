/** Tiny deterministic PRNG (mulberry32). Pure — use instead of Math.random for
 *  decorative/procedural generation so it's stable across renders and lint-clean. */
export function makeRng(seed = 1) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
