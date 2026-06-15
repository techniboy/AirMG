import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "../api/client";
import { settingsAtom, type ProfileSettings } from "../atoms/api";
import { themeAtom, type Theme } from "../atoms/theme";

const DEFAULT_SETTINGS: ProfileSettings = {
	age: null,
	sex: null,
	weight_kg: null,
	height_cm: null,
	unit_system: "metric",
	hr_max: null,
	sleep_need_hours: null,
};

export default function Settings() {
	const { data, isPending, error } = useAtomValue(settingsAtom);

	const [overrides, setOverrides] = useState<Partial<ProfileSettings>>({});
	const form = { ...(data ?? DEFAULT_SETTINGS), ...overrides };
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const queryClient = useQueryClient();
	const [syncing, setSyncing] = useState(false);
	const [syncMsg, setSyncMsg] = useState<string | null>(null);
	const [syncError, setSyncError] = useState<string | null>(null);

	async function handleSync() {
		setSyncing(true);
		setSyncMsg(null);
		setSyncError(null);
		try {
			const res = await api<{ synced: Record<string, number | { error: string }> }>(
				"/sync/start",
				{ method: "POST" },
			);
			const total = Object.values(res.synced).reduce<number>(
				(n, v) => n + (typeof v === "number" ? v : 0),
				0,
			);
			setSyncMsg(`Synced ${total} new record${total === 1 ? "" : "s"}.`);
			// Refresh every dashboard query with the freshly synced data.
			queryClient.invalidateQueries();
		} catch (err) {
			setSyncError(err instanceof Error ? err.message : "Sync failed");
		} finally {
			setSyncing(false);
		}
	}

	function setField<K extends keyof ProfileSettings>(
		key: K,
		value: ProfileSettings[K],
	) {
		setOverrides((prev) => ({ ...prev, [key]: value }));
		setSaved(false);
	}

	async function handleSave(e: React.SyntheticEvent<HTMLFormElement>) {
		e.preventDefault();
		setSaving(true);
		setSaveError(null);
		try {
			await api("/api/settings", {
				method: "PUT",
				body: JSON.stringify(form),
			});
			setSaved(true);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "Save failed");
		} finally {
			setSaving(false);
		}
	}

	const [theme, setTheme] = useAtom(themeAtom);

	if (isPending) return <div className="text-text-secondary">Loading…</div>;
	if (error) return <div className="text-sm text-status-critical">{String(error)}</div>;

	const THEMES: { value: Theme; label: string; desc: string }[] = [
		{ value: "dark", label: "Dark", desc: "NOOP-inspired dark theme" },
		{ value: "liquid-glass", label: "Liquid Glass", desc: "Apple iOS 26 translucent glass" },
		{ value: "orbital", label: "Orbital", desc: "Living 3D world (WebGPU)" },
		{ value: "radio", label: "Radio City", desc: "HACF neon city nightlife" },
	];

	return (
		<div className="mx-auto max-w-lg space-y-6">
			<h1 className="text-2xl font-bold">Settings</h1>

			<Card className="border-hairline bg-surface-raised p-5 space-y-4">
				<div className="text-xs uppercase tracking-widest text-text-tertiary">
					Appearance
				</div>
				<div className="flex gap-2">
					{THEMES.map((t) => (
						<button
							key={t.value}
							type="button"
							onClick={() => setTheme(t.value)}
							className={`flex-1 rounded-lg border px-3 py-3 text-left transition-colors ${
								theme === t.value
									? "border-accent bg-accent-muted text-accent"
									: "border-hairline text-text-secondary hover:text-text-primary"
							}`}
						>
							<div className="text-sm font-medium">{t.label}</div>
							<div className="text-[11px] mt-0.5 opacity-60">{t.desc}</div>
						</button>
					))}
				</div>
			</Card>

			<Card className="border-hairline bg-surface-raised p-5 space-y-4">
				<div className="text-xs uppercase tracking-widest text-text-tertiary">
					Data
				</div>
				<p className="text-sm text-text-secondary">
					Pull the latest heart rate, HRV, sleep, SpO₂, workouts and steps from
					Google Health, then recompute your metrics.
				</p>
				<div className="flex items-center gap-3">
					<Button
						type="button"
						onClick={handleSync}
						disabled={syncing}
						className="bg-accent text-surface-base hover:bg-accent-hover"
					>
						{syncing ? "Syncing…" : "Sync now"}
					</Button>
					{syncMsg && (
						<span className="text-sm text-status-positive">{syncMsg}</span>
					)}
					{syncError && (
						<span className="text-sm text-status-critical">{syncError}</span>
					)}
				</div>
			</Card>

			<form onSubmit={handleSave} className="space-y-4">
				<Card className="border-hairline bg-surface-raised p-5 space-y-4">
					<div className="text-xs uppercase tracking-widest text-text-tertiary">
						Profile
					</div>

					<div className="space-y-1.5">
						<label className="text-sm text-text-secondary" htmlFor="age">
							Age
						</label>
						<input
							id="age"
							type="number"
							min={10}
							max={120}
							value={form.age ?? ""}
							onChange={(e) =>
								setField("age", e.target.value ? Number(e.target.value) : null)
							}
							className="w-full rounded-lg border border-hairline bg-surface-inset px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
							placeholder="e.g. 32"
						/>
					</div>

					<div className="space-y-1.5">
						<label className="text-sm text-text-secondary" htmlFor="sex">
							Biological sex
						</label>
						<select
							id="sex"
							value={form.sex ?? ""}
							onChange={(e) => setField("sex", e.target.value || null)}
							className="w-full rounded-lg border border-hairline bg-surface-inset px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
						>
							<option value="">Prefer not to say</option>
							<option value="male">Male</option>
							<option value="female">Female</option>
						</select>
					</div>

					<div className="space-y-1.5">
						<label className="text-sm text-text-secondary">Unit system</label>
						<div className="flex gap-2">
							{(["metric", "imperial"] as const).map((u) => (
								<button
									key={u}
									type="button"
									onClick={() => setField("unit_system", u)}
									className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors capitalize ${
										form.unit_system === u
											? "border-accent bg-accent-muted text-accent"
											: "border-hairline text-text-secondary hover:text-text-primary"
									}`}
								>
									{u}
								</button>
							))}
						</div>
					</div>
				</Card>

				<Card className="border-hairline bg-surface-raised p-5 space-y-4">
					<div className="text-xs uppercase tracking-widest text-text-tertiary">
						Body metrics
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<label className="text-sm text-text-secondary" htmlFor="weight">
								Weight ({form.unit_system === "metric" ? "kg" : "lbs"})
							</label>
							<input
								id="weight"
								type="number"
								min={20}
								max={300}
								step={0.1}
								value={form.weight_kg ?? ""}
								onChange={(e) =>
									setField(
										"weight_kg",
										e.target.value ? Number(e.target.value) : null,
									)
								}
								className="w-full rounded-lg border border-hairline bg-surface-inset px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
								placeholder="e.g. 70"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-sm text-text-secondary" htmlFor="height">
								Height ({form.unit_system === "metric" ? "cm" : "in"})
							</label>
							<input
								id="height"
								type="number"
								min={100}
								max={250}
								step={0.1}
								value={form.height_cm ?? ""}
								onChange={(e) =>
									setField(
										"height_cm",
										e.target.value ? Number(e.target.value) : null,
									)
								}
								className="w-full rounded-lg border border-hairline bg-surface-inset px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
								placeholder="e.g. 175"
							/>
						</div>
					</div>

					<div className="space-y-1.5">
						<label className="text-sm text-text-secondary" htmlFor="hrmax">
							Max heart rate{" "}
							<span className="text-text-tertiary">
								(bpm, used for HR zones)
							</span>
						</label>
						<input
							id="hrmax"
							type="number"
							min={100}
							max={220}
							value={form.hr_max ?? ""}
							onChange={(e) =>
								setField(
									"hr_max",
									e.target.value ? Number(e.target.value) : null,
								)
							}
							className="w-full rounded-lg border border-hairline bg-surface-inset px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
							placeholder={`e.g. ${form.age ? 220 - form.age : 190}`}
						/>
					</div>

					<div className="space-y-1.5">
						<label className="text-sm text-text-secondary" htmlFor="sleepneed">
							Sleep need{" "}
							<span className="text-text-tertiary">(hours/night)</span>
						</label>
						<input
							id="sleepneed"
							type="number"
							min={4}
							max={12}
							step={0.5}
							value={form.sleep_need_hours ?? ""}
							onChange={(e) =>
								setField(
									"sleep_need_hours",
									e.target.value ? Number(e.target.value) : null,
								)
							}
							className="w-full rounded-lg border border-hairline bg-surface-inset px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
							placeholder="e.g. 8"
						/>
					</div>
				</Card>

				{saveError && (
					<p className="text-sm text-status-critical">{saveError}</p>
				)}

				<div className="flex items-center gap-3">
					<Button
						type="submit"
						disabled={saving}
						className="bg-accent text-surface-base hover:bg-accent-hover"
					>
						{saving ? "Saving…" : "Save settings"}
					</Button>
					{saved && (
						<span className="text-sm text-status-positive">Saved!</span>
					)}
				</div>
			</form>
		</div>
	);
}
