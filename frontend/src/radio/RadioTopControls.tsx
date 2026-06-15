import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { Check, Palette, RefreshCw, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { type Theme, themeAtom } from "../atoms/theme";

const THEMES: { v: Theme; l: string; warn?: string }[] = [
	{ v: "radio", l: "Radio City" },
	{ v: "dark", l: "Dark" },
	{ v: "liquid-glass", l: "Liquid Glass" },
	{ v: "orbital", l: "Orbital", warn: "GPU intensive" },
];

function ago(iso: string | null): string {
	if (!iso) return "never";
	const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 60) return "just now";
	if (s < 3600) return `${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
	return `${Math.floor(s / 86400)}d ago`;
}

/** Icon-only sync + theme controls for the Radio top bar. */
export function RadioTopControls() {
	const qc = useQueryClient();
	const [theme, setTheme] = useAtom(themeAtom);
	const [syncing, setSyncing] = useState(false);
	const [open, setOpen] = useState(false);
	const [toast, setToast] = useState<string | null>(null);
	const ref = useRef<HTMLDivElement>(null);

	const { data: status } = useQuery({
		queryKey: ["sync-status"],
		queryFn: () => api<{ sync_states: Record<string, { last_synced: string | null }> }>("/sync/status"),
	});
	const lastSynced = status
		? Object.values(status.sync_states)
				.map((s) => s.last_synced)
				.filter(Boolean)
				.sort()
				.at(-1) ?? null
		: null;

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	function flash(msg: string) {
		setToast(msg);
		setTimeout(() => setToast(null), 3500);
	}

	async function sync() {
		setSyncing(true);
		try {
			const res = await api<{ synced: Record<string, number | { error: string }> }>(
				"/sync/start",
				{ method: "POST" },
			);
			const total = Object.values(res.synced).reduce<number>(
				(n, v) => n + (typeof v === "number" ? v : 0),
				0,
			);
			qc.invalidateQueries();
			flash(
				total === 0
					? "No new data on Google yet — nothing to sync."
					: `Synced ${total} new record${total === 1 ? "" : "s"}.`,
			);
		} catch (err) {
			flash(err instanceof Error ? err.message : "Sync failed.");
		} finally {
			setSyncing(false);
		}
	}

	return (
		<div className="radio-topctl" ref={ref}>
			<span className="radio-synced" title={`Last synced ${ago(lastSynced)}`}>
				synced {ago(lastSynced)}
			</span>
			<button
				type="button"
				className="radio-iconbtn"
				onClick={sync}
				disabled={syncing}
				title={syncing ? "Syncing…" : `Sync data · last ${ago(lastSynced)}`}
				aria-label="Sync data"
			>
				<RefreshCw size={15} className={syncing ? "spin" : ""} />
			</button>

			<div style={{ position: "relative" }}>
				<button
					type="button"
					className="radio-iconbtn"
					onClick={() => setOpen((o) => !o)}
					title="Theme"
					aria-label="Theme"
				>
					<Palette size={15} />
				</button>
				{open && (
					<div className="radio-menu" role="menu">
						{THEMES.map((t) => (
							<button
								key={t.v}
								type="button"
								role="menuitemradio"
								aria-checked={theme === t.v}
								className={`radio-menu-item${theme === t.v ? " on" : ""}`}
								onClick={() => {
									setTheme(t.v);
									setOpen(false);
								}}
							>
								<span className="lbl">
									{t.l}
									{t.warn && (
										<span className="warn">
											<Zap size={9} /> {t.warn}
										</span>
									)}
								</span>
								{theme === t.v && <Check size={13} />}
							</button>
						))}
					</div>
				)}
			</div>
			{toast && <div className="radio-toast">{toast}</div>}
		</div>
	);
}
