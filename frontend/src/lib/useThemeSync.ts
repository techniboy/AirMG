import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useState } from "react";
import { api } from "../api/client";
import { type Theme, themeAtom } from "../atoms/theme";

export const THEMES: { v: Theme; l: string; warn?: string }[] = [
	{ v: "radio", l: "Radio City" },
	{ v: "dark", l: "Dark" },
	{ v: "liquid-glass", l: "Liquid Glass" },
	{ v: "orbital", l: "Orbital", warn: "GPU intensive" },
];

export function ago(iso: string | null): string {
	if (!iso) return "never";
	const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 60) return "just now";
	if (s < 3600) return `${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
	return `${Math.floor(s / 86400)}d ago`;
}

/** Shared sync + theme state for the top-bar (radio) and sidebar (dark/glass) controls. */
export function useThemeSync() {
	const qc = useQueryClient();
	const [theme, setTheme] = useAtom(themeAtom);
	const [syncing, setSyncing] = useState(false);
	const [toast, setToast] = useState<string | null>(null);

	const { data: status } = useQuery({
		queryKey: ["sync-status"],
		queryFn: () =>
			api<{ sync_states: Record<string, { last_synced: string | null }> }>("/sync/status"),
	});
	const lastSynced = status
		? (Object.values(status.sync_states)
				.map((s) => s.last_synced)
				.filter(Boolean)
				.sort()
				.at(-1) ?? null)
		: null;

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

	return { theme, setTheme, syncing, toast, sync, lastSyncedAgo: ago(lastSynced) };
}
