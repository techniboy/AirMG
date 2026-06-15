import { Check, Palette, RefreshCw, Zap } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { THEMES, useThemeSync } from "../lib/useThemeSync";

/** Icon-only sync + theme controls for the Radio sidebar rail. */
export function RadioTopControls() {
	const { theme, setTheme, syncing, toast, sync, lastSyncedAgo } = useThemeSync();
	const [open, setOpen] = useState(false);
	const [flyout, setFlyout] = useState<{ left: number; bottom: number }>();
	const ref = useRef<HTMLDivElement>(null);

	// The rail clips overflow, so flyouts (menu/toast) are positioned fixed,
	// anchored just right of the controls.
	useLayoutEffect(() => {
		if (!(open || toast) || !ref.current) return;
		const r = ref.current.getBoundingClientRect();
		const rail = (ref.current.closest(".radio-rail") ?? ref.current).getBoundingClientRect();
		setFlyout({ left: rail.right + 8, bottom: window.innerHeight - r.bottom });
	}, [open, toast]);

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

	return (
		<div className="radio-topctl" ref={ref}>
			<button
				type="button"
				className="radio-iconbtn"
				onClick={sync}
				disabled={syncing}
				title={syncing ? "Syncing…" : `Sync data · last ${lastSyncedAgo}`}
				aria-label="Sync data"
			>
				<RefreshCw size={15} className={syncing ? "spin" : ""} />
			</button>

			<div>
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
					<div className="radio-menu" role="menu" style={{ position: "fixed", ...flyout }}>
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
			<span className="radio-synced" title={`Last synced ${lastSyncedAgo}`}>
				{lastSyncedAgo}
			</span>
			{toast && (
				<div className="radio-toast" style={{ position: "fixed", ...flyout }}>
					{toast}
				</div>
			)}
		</div>
	);
}
