import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAtomValue } from "jotai";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "../api/client";
import { settingsAtom, type ProfileSettings } from "../atoms/api";

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
	const [resyncing, setResyncing] = useState(false);
	const [resyncMsg, setResyncMsg] = useState<string | null>(null);

	async function handleFullResync() {
		setResyncing(true);
		setResyncMsg(null);
		try {
			const res = await api<{ synced: Record<string, number | { error: string }> }>(
				"/sync/full?days=365",
				{ method: "POST" },
			);
			const total = Object.values(res.synced).reduce<number>(
				(n, v) => n + (typeof v === "number" ? v : 0),
				0,
			);
			setResyncMsg(`Pulled ${total} record${total === 1 ? "" : "s"} across the last year.`);
			queryClient.invalidateQueries();
		} catch (err) {
			setResyncMsg(err instanceof Error ? err.message : "Full re-sync failed");
		} finally {
			setResyncing(false);
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

	if (isPending) return <div className="text-text-secondary">Loading…</div>;
	if (error) return <div className="text-sm text-status-critical">{String(error)}</div>;

	return (
		<div className="mx-auto max-w-lg space-y-6">
			<h1 className="text-2xl font-bold">Settings</h1>

			<Card className="border-hairline bg-surface-raised p-5 space-y-4">
				<div className="text-xs uppercase tracking-widest text-text-tertiary">Data</div>
				<p className="text-sm text-text-secondary">
					Re-pull your full Google Health history (last year) from scratch and recompute
					every day. Use this after a gap, or to backfill. Safe to re-run — it only fills
					what's missing. May take a while.
				</p>
				<div className="flex items-center gap-3">
					<Button
						type="button"
						onClick={handleFullResync}
						disabled={resyncing}
						className="bg-accent text-surface-base hover:bg-accent-hover"
					>
						{resyncing ? "Re-syncing…" : "Full re-sync"}
					</Button>
					{resyncMsg && <span className="text-sm text-text-secondary">{resyncMsg}</span>}
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
