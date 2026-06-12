import { useState } from "react";

interface AlgoInfoProps {
	algo: keyof typeof ALGO_DETAILS;
}

const ALGO_DETAILS = {
	recovery: {
		title: "Recovery Score",
		summary:
			"A 0–100% score reflecting your body's readiness to perform, derived from overnight autonomic nervous system signals compared to your personal baselines.",
		method: "Weighted Z-Score Composite → Logistic Sigmoid",
		formula: [
			"z_hrv = (HRV − baseline_hrv) / (1.253 × spread_hrv)",
			"z_rhr = (baseline_rhr − RHR) / (1.253 × spread_rhr)  // inverted: lower is better",
			"z_resp = (baseline_resp − resp) / (1.253 × spread_resp)  // optional, 5% weight",
			"z_sleep = (sleep_perf − 0.85) / 0.12",
			"",
			"z_composite = Σ(zᵢ × wᵢ) / Σ(wᵢ)",
			"  where w_hrv=0.60, w_rhr=0.20, w_resp=0.05, w_sleep=0.15",
			"  (missing signals excluded, weights renormalized)",
			"",
			"recovery = 100 / (1 + e^(−1.6 × (z − (−0.20))))",
		],
		bands: "Red: <34% · Yellow: 34–67% · Green: >67%",
		notes:
			"Baselines use exponentially weighted moving averages (14-day half-life) with Winsorized updates (±3σ clamping) and hard outlier rejection (>5σ). Requires ≥4 nights to seed, ≥14 for trusted status. The logistic sigmoid maps the composite z-score onto 0–100, with the midpoint offset (−0.20) calibrated so a z=0 (perfectly average) day scores ~55%, not 50%.",
	},
	strain: {
		title: "Day Strain",
		summary:
			"A 0–21 measure of cardiovascular load accumulated throughout the day, based on time spent in each heart rate zone.",
		method: "Modified Edwards TRIMP → Logarithmic Scaling",
		formula: [
			"HR_max = 208 − 0.7 × age  (Tanaka formula)",
			"HR_reserve = HR_max − resting_HR",
			"%HRR = (bpm − resting_HR) / HR_reserve × 100",
			"",
			"Edwards zone weights:",
			"  ≥90% HRR → 5 pts/min",
			"  ≥80% HRR → 4 pts/min",
			"  ≥70% HRR → 3 pts/min",
			"  ≥60% HRR → 2 pts/min",
			"  ≥50% HRR → 1 pt/min",
			"  <50% HRR → 0",
			"",
			"TRIMP = Σ(zone_weight × sample_duration_min)",
			"strain = 21 × ln(TRIMP + 1) / ln(7201)",
		],
		bands: "Light: <6 · Moderate: 6–10 · Strenuous: 10–14 · High: 14–18 · All-out: 18–21",
		notes:
			"The logarithmic curve means early activity adds strain quickly but it becomes progressively harder to increase as you accumulate more. Reaching strain 21 requires ~7200 TRIMP points — roughly an elite multi-hour effort. Minimum 600 HR samples (~10 min at 1Hz) required.",
	},
	sleepScore: {
		title: "Sleep Score",
		summary:
			"A 0–100 composite score evaluating sleep quality across four dimensions, based on sleep medicine literature (Walker, AASM guidelines).",
		method: "Weighted Sub-Score Composite",
		formula: [
			"sleep_score = (dur × 0.30 + eff × 0.20 + arch × 0.25 + auto × 0.25) × 100",
			"",
			"Duration (30%):",
			"  ≥8h → 100%",
			"  6–8h → 50–100% (linear)",
			"  <6h → 0–50% (proportional)",
			"",
			"Efficiency (20%):",
			"  ≥90% → 100%",
			"  85–90% → 70–100%",
			"  <85% → 0–70% (proportional)",
			"",
			"Architecture (25%):",
			"  Deep: ideal 13–23% of total sleep",
			"  REM: ideal 20–25% of total sleep",
			"  Score = avg of band scores (100% in range, degrades outside)",
			"",
			"Autonomic (25%):",
			"  z_hrv = (HRV − baseline) / spread → clamped to 0.5 ± 0.25z",
			"  z_rhr = (baseline − RHR) / spread → clamped to 0.5 ± 0.25z",
			"  Score = avg of available z-mapped sub-scores",
		],
		bands: null,
		notes:
			"If a component is unavailable (e.g., no stage data), it defaults to 0.5 (neutral). The autonomic component rewards nights where HRV is above baseline and RHR is below baseline, reflecting parasympathetic dominance during sleep.",
	},
	readiness: {
		title: "Readiness Assessment",
		summary:
			"A signal-based assessment combining 4 independent indicators to determine training readiness. Unlike Recovery (which is a precise score), Readiness provides a categorical recommendation.",
		method: "Multi-Signal Flag Aggregation",
		formula: [
			"Signals evaluated (each → good/neutral/watch/bad):",
			"",
			"1. HRV: z-score vs baseline",
			"   good: z > 0 · neutral: z > −0.5 · watch: z > −1.0 · bad: z ≤ −1.0",
			"",
			"2. Resting HR: deviation from baseline (bpm)",
			"   good: ≤0 · neutral: ≤2 · watch: ≤4 · bad: >4",
			"",
			"3. Training Load: ACWR (acute 7d / chronic 28d)",
			"   good: 0.8–1.3 · watch: 0.5–0.8 or 1.3–1.5 · bad: outside",
			"",
			"4. Sleep Debt: avg last 3 nights vs sleep need",
			"   good: ≥90% · neutral: ≥80% · watch: ≥70% · bad: <70%",
			"",
			"Level = rundown (any bad) > strained (any watch) > primed (all good) > balanced",
		],
		bands: null,
		notes:
			"ACWR (Acute:Chronic Workload Ratio) is a sports science metric. The 0.8–1.3 'sweet spot' balances training stimulus with recovery capacity. Requires ≥7 days of data. Sleep need defaults to 8h if not configured in Settings.",
	},
	baselines: {
		title: "Personal Baselines",
		summary:
			"Your personal reference values for HRV, resting HR, and respiratory rate. All calculated metrics compare today's values against these adaptive baselines.",
		method: "Exponentially Weighted Moving Average (EWMA)",
		formula: [
			"λ_b = 1 − 0.5^(1/14)  // baseline half-life: 14 days",
			"λ_s = 1 − 0.5^(1/21)  // spread half-life: 21 days",
			"",
			"On each new value:",
			"  1. Hard outlier rejection: |value − baseline| > 5σ → skip",
			"  2. Winsorize: clamp value to baseline ± 3σ",
			"  3. new_baseline = λ_b × clamped + (1 − λ_b) × old_baseline",
			"  4. new_spread = max(floor, λ_s × |value − new_baseline| + (1 − λ_s) × old_spread)",
			"",
			"Status progression:",
			"  calibrating (<4 nights) → provisional (4–13) → trusted (≥14)",
			"  stale: no updates for 14 days",
		],
		bands: null,
		notes:
			"The 14-day half-life means ~50% of your baseline reflects the last 2 weeks, with older data fading exponentially. Spread floors prevent division-by-zero: HRV ≥5ms, RHR ≥2bpm, Resp ≥0.5rpm. The σ estimate uses spread × 1.253 (MAD→SD conversion for normal distributions).",
	},
} as const;

export function AlgoInfo({ algo }: AlgoInfoProps) {
	const [open, setOpen] = useState(false);
	const info = ALGO_DETAILS[algo];

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-text-tertiary/40 text-text-tertiary hover:text-text-secondary hover:border-text-secondary/60 transition-colors text-[9px] leading-none font-medium"
				title={`How ${info.title} is calculated`}
			>
				i
			</button>

			{open && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
					onClick={() => setOpen(false)}
				>
					<div
						className="bg-surface-raised border border-hairline rounded-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="p-6 space-y-4">
							<div className="flex items-start justify-between">
								<div>
									<h2 className="text-lg font-bold text-text-primary">
										{info.title}
									</h2>
									<div className="text-xs text-text-tertiary mt-0.5">
										{info.method}
									</div>
								</div>
								<button
									type="button"
									onClick={() => setOpen(false)}
									className="text-text-tertiary hover:text-text-primary text-lg leading-none px-1"
								>
									×
								</button>
							</div>

							<p className="text-sm text-text-secondary leading-relaxed">
								{info.summary}
							</p>

							<div className="space-y-1">
								<div className="text-xs uppercase tracking-widest text-text-tertiary">
									Formula
								</div>
								<pre className="text-xs text-text-secondary bg-surface-inset rounded-lg p-3 overflow-x-auto whitespace-pre leading-relaxed font-mono">
									{info.formula.join("\n")}
								</pre>
							</div>

							{info.bands && (
								<div className="space-y-1">
									<div className="text-xs uppercase tracking-widest text-text-tertiary">
										Bands
									</div>
									<div className="text-sm text-text-secondary">
										{info.bands}
									</div>
								</div>
							)}

							<div className="space-y-1">
								<div className="text-xs uppercase tracking-widest text-text-tertiary">
									Notes
								</div>
								<p className="text-xs text-text-tertiary leading-relaxed">
									{info.notes}
								</p>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
