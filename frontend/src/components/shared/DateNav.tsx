import type { PrimitiveAtom } from "jotai";
import { useAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../api/client";
import { recoveryHex } from "../../lib/colors";

function localDayStr(dt: Date): string {
	const yy = dt.getFullYear();
	const mm = String(dt.getMonth() + 1).padStart(2, "0");
	const dd = String(dt.getDate()).padStart(2, "0");
	return `${yy}-${mm}-${dd}`;
}

function todayStr() {
	// Local date, not toISOString() (UTC) — backend day boundaries are local.
	return localDayStr(new Date());
}

function offsetDay(base: string, delta: number): string {
	const [y, m, d] = base.split("-").map(Number);
	return localDayStr(new Date(y, m - 1, d + delta));
}

function relativeLabel(day: string): string {
	if (day === todayStr()) return "Today";
	if (day === offsetDay(todayStr(), -1)) return "Yesterday";
	const [y, m, d] = day.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

interface DateNavProps {
	dayAtom: PrimitiveAtom<string>;
}

export function DateNav({ dayAtom }: DateNavProps) {
	const [selectedDay, setSelectedDay] = useAtom(dayAtom);
	const [open, setOpen] = useState(false);
	// Month shown in the popover: [year, monthIndex]. Seeded from the selected day.
	const [view, setView] = useState(() => {
		const [y, m] = selectedDay.split("-").map(Number);
		return { y, m: m - 1 };
	});
	const wrapRef = useRef<HTMLDivElement>(null);

	// Close on outside click / Escape.
	useEffect(() => {
		if (!open) return;
		function onDown(e: MouseEvent) {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const monthStart = localDayStr(new Date(view.y, view.m, 1));
	const monthEnd = localDayStr(new Date(view.y, view.m + 1, 0));

	// Recovery score per day for the visible month → calendar dots. Only fetched while open.
	const { data } = useQuery({
		queryKey: ["datenav-recovery", monthStart, monthEnd],
		enabled: open,
		queryFn: () =>
			api<{ days: { day: string; recovery: number | null }[] }>(
				`/api/trends?start=${monthStart}&end=${monthEnd}&metrics=recovery`,
			),
	});
	const recoveryByDay = new Map(data?.days.map((d) => [d.day, d.recovery]) ?? []);

	const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
	// JS getDay(): Sun=0. Shift so Mon=0 to match the Mon-first header.
	const leading = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
	const today = todayStr();

	const btn =
		"rounded-lg border border-hairline bg-surface-raised p-1.5 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:hover:text-text-secondary";

	return (
		<div ref={wrapRef} className="relative flex items-center gap-2">
			<button
				className={btn}
				aria-label="Previous day"
				onClick={() => setSelectedDay(offsetDay(selectedDay, -1))}
			>
				<ChevronLeft size={16} />
			</button>

			<button
				className="min-w-[120px] rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-center text-sm font-medium text-text-primary hover:border-accent transition-colors"
				onClick={() => {
					const [y, m] = selectedDay.split("-").map(Number);
					setView({ y, m: m - 1 });
					setOpen((o) => !o);
				}}
			>
				{relativeLabel(selectedDay)}
			</button>

			<button
				className={btn}
				aria-label="Next day"
				onClick={() => setSelectedDay(offsetDay(selectedDay, 1))}
				disabled={selectedDay >= today}
			>
				<ChevronRight size={16} />
			</button>

			{open && (
				<div className="absolute top-full left-0 z-50 mt-2 w-64 rounded-xl border border-hairline bg-surface-raised p-3 shadow-xl">
					<div className="mb-2 flex items-center justify-between">
						<button
							className={btn}
							aria-label="Previous month"
							onClick={() => setView((v) => ({ y: v.m === 0 ? v.y - 1 : v.y, m: (v.m + 11) % 12 }))}
						>
							<ChevronLeft size={16} />
						</button>
						<span className="text-sm font-medium text-text-primary">
							{new Date(view.y, view.m, 1).toLocaleDateString(undefined, {
								month: "long",
								year: "numeric",
							})}
						</span>
						<button
							className={btn}
							aria-label="Next month"
							disabled={view.y > Number(today.slice(0, 4)) || (String(view.y) === today.slice(0, 4) && view.m >= Number(today.slice(5, 7)) - 1)}
							onClick={() => setView((v) => ({ y: v.m === 11 ? v.y + 1 : v.y, m: (v.m + 1) % 12 }))}
						>
							<ChevronRight size={16} />
						</button>
					</div>

					<div className="grid grid-cols-7 gap-1 text-center text-[10px] text-text-tertiary">
						{WEEKDAYS.map((w, i) => (
							<div key={i}>{w}</div>
						))}
					</div>

					<div className="mt-1 grid grid-cols-7 gap-1">
						{Array.from({ length: leading }).map((_, i) => (
							<div key={`pad-${i}`} />
						))}
						{Array.from({ length: daysInMonth }).map((_, i) => {
							const dayNum = i + 1;
							const dayStr = localDayStr(new Date(view.y, view.m, dayNum));
							const future = dayStr > today;
							const isSelected = dayStr === selectedDay;
							const dot = recoveryHex(recoveryByDay.get(dayStr) ?? null);
							return (
								<button
									key={dayNum}
									disabled={future}
									onClick={() => {
										setSelectedDay(dayStr);
										setOpen(false);
									}}
									className={`relative flex aspect-square items-center justify-center rounded-md text-xs transition-colors disabled:opacity-25 ${
										isSelected
											? "bg-accent text-surface-base font-semibold"
											: "text-text-secondary hover:bg-surface-inset"
									}`}
								>
									{dayNum}
									{dot && !isSelected && (
										<span
											className="absolute bottom-1 h-1 w-1 rounded-full"
											style={{ backgroundColor: dot }}
										/>
									)}
								</button>
							);
						})}
					</div>

					<button
						className="mt-3 w-full rounded-lg border border-hairline py-1.5 text-xs text-accent hover:bg-surface-inset transition-colors"
						onClick={() => {
							setSelectedDay(today);
							setOpen(false);
						}}
					>
						Jump to today
					</button>
				</div>
			)}
		</div>
	);
}
