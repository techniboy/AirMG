from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PeriodComparison:
    current_avg: float | None
    previous_avg: float | None
    delta: float | None
    pct_change: float | None


class ComparisonEngine:
    @staticmethod
    def _avg(days: list[dict], metric: str) -> float | None:
        vals = [d[metric] for d in days if d.get(metric) is not None]
        if not vals:
            return None
        return sum(vals) / len(vals)

    @staticmethod
    def compare(
        current: list[dict],
        previous: list[dict],
        metrics: list[str],
    ) -> dict[str, dict]:
        result = {}
        for m in metrics:
            c_avg = ComparisonEngine._avg(current, m)
            p_avg = ComparisonEngine._avg(previous, m)
            delta = None
            pct = None
            if c_avg is not None and p_avg is not None:
                delta = round(c_avg - p_avg, 2)
                if p_avg != 0:
                    pct = round((c_avg - p_avg) / p_avg * 100, 1)
            result[m] = {
                "current_avg": round(c_avg, 2) if c_avg is not None else None,
                "previous_avg": round(p_avg, 2) if p_avg is not None else None,
                "delta": delta,
                "pct_change": pct,
            }
        return result
