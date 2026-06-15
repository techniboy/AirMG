import { atom, useSetAtom } from "jotai";
import type { MouseEvent } from "react";

export interface RadioTip {
	x: number;
	y: number;
	value: string;
	label?: string;
	/** colour of the hovered cell — tints the readout */
	color?: string;
}

export const radioTipAtom = atom<RadioTip | null>(null);

/** Returns a binder: spread `bind(value, label, color)` onto any hoverable
 *  element to pop the CRT/LCD tooltip (tinted to the cell colour) at the cursor. */
export function useTipBind() {
	const set = useSetAtom(radioTipAtom);
	return (value: string, label?: string, color?: string) => ({
		onMouseMove: (e: MouseEvent) =>
			set({ x: e.clientX, y: e.clientY, value, label, color }),
		onMouseLeave: () => set(null),
	});
}
