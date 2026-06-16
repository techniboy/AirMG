import { useCallback, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import type { JournalQuestion } from "../atoms/api";
import { Card } from "@/components/ui/card";
import { api } from "../api/client";
import {
	journalCatalogAtom,
	journalEntriesAtom,
	journalDayAtom,
} from "../atoms/api";
import { DateNav } from "../components/shared/DateNav";

function categoryIcon(category: string): string {
	const map: Record<string, string> = {
		alcohol: "🍷",
		caffeine: "☕",
		sleep: "◐",
		exercise: "▶",
		stress: "〜",
		nutrition: "◉",
		meditation: "◇",
		mood: "♥",
	};
	const key = category.toLowerCase();
	for (const [k, v] of Object.entries(map)) {
		if (key.includes(k)) return v;
	}
	return "•";
}

export default function Journal() {
	const selectedDay = useAtomValue(journalDayAtom);
	const [answers, setAnswers] = useState<Record<string, boolean>>({});
	const [saving, setSaving] = useState<string | null>(null);

	const { data: catalogData } = useAtomValue(journalCatalogAtom);
	const { data: entriesData, error: entriesError } =
		useAtomValue(journalEntriesAtom);

	const questions = catalogData?.questions ?? [];

	useEffect(() => {
		// Seed the local toggle state from the fetched entries whenever the day changes.
		const map: Record<string, boolean> = {};
		for (const e of entriesData?.entries ?? []) map[e.question_id] = e.answer;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional server→local sync on day change
		setAnswers(map);
	}, [entriesData, selectedDay]);

	const toggleAnswer = useCallback(
		async (questionId: string, question: string) => {
			const current = answers[questionId] ?? false;
			const newVal = !current;
			setAnswers((prev) => ({ ...prev, [questionId]: newVal }));
			setSaving(questionId);
			try {
				await api("/api/journal", {
					method: "POST",
					body: JSON.stringify({
						day: selectedDay,
						question_id: questionId,
						question,
						answer: newVal,
					}),
				});
			} catch {
				setAnswers((prev) => ({ ...prev, [questionId]: current }));
			} finally {
				setSaving(null);
			}
		},
		[answers, selectedDay],
	);

	// Group questions by category
	const grouped = questions.reduce<Record<string, JournalQuestion[]>>(
		(acc, q) => {
			const cat = q.category || "General";
			if (!acc[cat]) acc[cat] = [];
			acc[cat].push(q);
			return acc;
		},
		{},
	);

	const answeredCount = Object.values(answers).filter(Boolean).length;

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			{/* Header + date nav */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Journal</h1>
					{questions.length > 0 && (
						<p className="text-sm text-text-secondary mt-0.5">
							{answeredCount} of {questions.length} answered
						</p>
					)}
				</div>
				<DateNav dayAtom={journalDayAtom} />
			</div>

			{entriesError && (
				<div className="text-sm text-status-critical">{String(entriesError)}</div>
			)}

			{questions.length === 0 && (
				<Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
					No journal questions configured yet.
				</Card>
			)}

			{/* Questions grouped by category */}
			{Object.entries(grouped).map(([category, qs]) => (
				<div key={category} className="space-y-2">
					<div className="flex items-center gap-2 px-1">
						<span className="text-base">{categoryIcon(category)}</span>
						<span className="text-xs uppercase tracking-widest text-text-tertiary">
							{category}
						</span>
					</div>
					<Card className="border-hairline bg-surface-raised overflow-hidden">
						<div className="divide-y divide-hairline">
							{qs.map((q) => {
								const checked = answers[q.id] ?? false;
								const isSaving = saving === q.id;
								return (
									<button
										key={q.id}
										className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-surface-overlay"
										onClick={() => toggleAnswer(q.id, q.question)}
										disabled={isSaving}
									>
										<span
											className={`text-sm ${checked ? "text-text-primary" : "text-text-secondary"}`}
										>
											{q.question}
										</span>
										<div className="ml-4 shrink-0">
											{isSaving ? (
												<div className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
											) : (
												<div
													className={`h-5 w-5 rounded-full border-2 transition-colors flex items-center justify-center ${
														checked
															? "border-accent bg-accent"
															: "border-hairline-strong bg-transparent"
													}`}
												>
													{checked && (
														<svg
															viewBox="0 0 10 8"
															className="h-3 w-3 fill-surface-base"
														>
															<path
																d="M1 4l3 3 5-6"
																stroke="currentColor"
																strokeWidth="1.5"
																fill="none"
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
														</svg>
													)}
												</div>
											)}
										</div>
									</button>
								);
							})}
						</div>
					</Card>
				</div>
			))}

			{questions.length > 0 && (
				<p className="text-xs text-text-tertiary text-center">
					Toggle behaviours to log whether they happened today. After a few
					days, Insights will rank their effect on your metrics.
				</p>
			)}
		</div>
	);
}
