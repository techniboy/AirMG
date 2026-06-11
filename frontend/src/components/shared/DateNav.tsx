import type { PrimitiveAtom } from "jotai";
import { useAtom } from "jotai";

function todayStr() {
	return new Date().toISOString().slice(0, 10);
}

function offsetDay(base: string, delta: number): string {
	const [y, m, d] = base.split("-").map(Number);
	const dt = new Date(y, m - 1, d + delta);
	const yy = dt.getFullYear();
	const mm = String(dt.getMonth() + 1).padStart(2, "0");
	const dd = String(dt.getDate()).padStart(2, "0");
	return `${yy}-${mm}-${dd}`;
}

interface DateNavProps {
	dayAtom: PrimitiveAtom<string>;
}

export function DateNav({ dayAtom }: DateNavProps) {
	const [selectedDay, setSelectedDay] = useAtom(dayAtom);

	return (
		<div className="flex items-center gap-2">
			<button
				className="rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
				onClick={() => setSelectedDay(offsetDay(selectedDay, -1))}
			>
				←
			</button>
			<span className="min-w-[100px] text-center text-sm text-text-secondary">
				{selectedDay}
			</span>
			<button
				className="rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
				onClick={() => setSelectedDay(offsetDay(selectedDay, 1))}
				disabled={selectedDay >= todayStr()}
			>
				→
			</button>
			<button
				className="rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-sm text-accent hover:opacity-80 transition-opacity"
				onClick={() => setSelectedDay(todayStr())}
			>
				Today
			</button>
		</div>
	);
}
