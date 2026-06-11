from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class BehaviorEffect:
    question_key: str
    question: str
    category: str
    with_mean: float
    without_mean: float
    effect_size: float
    n_with: int
    n_without: int
    significant: bool
    direction: str  # "positive" | "negative" | "neutral"
    sentence: str

    def to_dict(self) -> dict:
        return {
            "question_key": self.question_key,
            "question": self.question,
            "category": self.category,
            "with_mean": round(self.with_mean, 2),
            "without_mean": round(self.without_mean, 2),
            "effect_size": round(self.effect_size, 3),
            "n_with": self.n_with,
            "n_without": self.n_without,
            "significant": self.significant,
            "direction": self.direction,
            "sentence": self.sentence,
        }


class BehaviorInsights:
    MIN_GROUP_SIZE = 5

    @staticmethod
    def _cohens_d(with_vals: list[float], without_vals: list[float]) -> float:
        """Compute Cohen's d using pooled standard deviation formula."""
        n1 = len(with_vals)
        n2 = len(without_vals)
        if n1 < 2 or n2 < 2:
            return 0.0

        mean1 = sum(with_vals) / n1
        mean2 = sum(without_vals) / n2

        var1 = sum((x - mean1) ** 2 for x in with_vals) / (n1 - 1)
        var2 = sum((x - mean2) ** 2 for x in without_vals) / (n2 - 1)

        pooled_sd = math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
        if pooled_sd < 1e-10:
            return 0.0

        return (mean1 - mean2) / pooled_sd

    @staticmethod
    def analyze(
        journal: dict[str, dict[str, bool]],
        metrics: dict[str, float],
        questions: dict[str, dict],
        outcome_name: str,
        higher_is_better: bool,
    ) -> list[BehaviorEffect]:
        """
        Analyze behavioral effects on a metric using Cohen's d.

        Args:
            journal: question_key → {day → bool}
            metrics: day → metric value
            questions: question_key → {question, category}
            outcome_name: human-readable metric name
            higher_is_better: True for HRV/recovery/sleep, False for resting HR

        Returns:
            List of BehaviorEffect sorted by |effect_size| descending.
        """
        effects: list[BehaviorEffect] = []

        for question_key, day_answers in journal.items():
            q_meta = questions.get(question_key)
            if not q_meta:
                continue

            with_vals: list[float] = []
            without_vals: list[float] = []

            for day, answered_yes in day_answers.items():
                value = metrics.get(day)
                if value is None:
                    continue
                if answered_yes:
                    with_vals.append(value)
                else:
                    without_vals.append(value)

            if len(with_vals) < BehaviorInsights.MIN_GROUP_SIZE:
                continue
            if len(without_vals) < BehaviorInsights.MIN_GROUP_SIZE:
                continue

            d = BehaviorInsights._cohens_d(with_vals, without_vals)

            with_mean = sum(with_vals) / len(with_vals)
            without_mean = sum(without_vals) / len(without_vals)

            # Determine direction based on whether higher values are good
            if abs(d) < 0.2:
                direction = "neutral"
            elif higher_is_better:
                # d > 0 means with_mean > without_mean → positive if higher is better
                direction = "positive" if d > 0 else "negative"
            else:
                # d > 0 means with_mean > without_mean → negative if higher is bad
                direction = "negative" if d > 0 else "positive"

            significant = abs(d) >= 0.5

            # Generate human-readable sentence
            question_text = q_meta.get("question", question_key)
            diff_pct = (
                abs(with_mean - without_mean) / without_mean * 100
                if without_mean != 0
                else 0.0
            )
            higher_lower = "higher" if with_mean > without_mean else "lower"
            direction_word = "better" if direction == "positive" else ("worse" if direction == "negative" else "similar")
            sentence = (
                f"On days you answered yes to '{question_text}', "
                f"{outcome_name} was {higher_lower} "
                f"({with_mean:.1f} vs {without_mean:.1f}, {diff_pct:.0f}% diff) — "
                f"a {direction_word} outcome."
            )

            effects.append(
                BehaviorEffect(
                    question_key=question_key,
                    question=question_text,
                    category=q_meta.get("category", ""),
                    with_mean=with_mean,
                    without_mean=without_mean,
                    effect_size=d,
                    n_with=len(with_vals),
                    n_without=len(without_vals),
                    significant=significant,
                    direction=direction,
                    sentence=sentence,
                )
            )

        effects.sort(key=lambda e: abs(e.effect_size), reverse=True)
        return effects
