from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True, slots=True)
class Correlation:
    r: float
    n: int
    p_approx: float
    slope: float
    intercept: float


class CorrelationEngine:
    @staticmethod
    def _erf_approx(x: float) -> float:
        t = 1.0 / (1.0 + 0.3275911 * abs(x))
        poly = t * (
            0.254829592
            + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))
        )
        result = 1.0 - poly * math.exp(-x * x)
        return result if x >= 0 else -result

    @staticmethod
    def _normal_cdf(x: float) -> float:
        return 0.5 * (1.0 + CorrelationEngine._erf_approx(x / math.sqrt(2.0)))

    @staticmethod
    def pearson(xy: list[tuple[float, float]]) -> Correlation | None:
        n = len(xy)
        if n < 3:
            return None

        n_f = float(n)
        sum_x = sum(p[0] for p in xy)
        sum_y = sum(p[1] for p in xy)
        mean_x = sum_x / n_f
        mean_y = sum_y / n_f

        ss_xx = sum((p[0] - mean_x) ** 2 for p in xy)
        ss_yy = sum((p[1] - mean_y) ** 2 for p in xy)
        ss_xy = sum((p[0] - mean_x) * (p[1] - mean_y) for p in xy)

        if ss_xx < 1e-15 or ss_yy < 1e-15:
            return None

        r = ss_xy / math.sqrt(ss_xx * ss_yy)
        slope = ss_xy / ss_xx
        intercept = mean_y - slope * mean_x

        r2 = r * r
        if r2 >= 1.0:
            p_approx = 0.0
        else:
            t_stat = r * math.sqrt((n - 2) / (1.0 - r2))
            p_approx = 2.0 * (1.0 - CorrelationEngine._normal_cdf(abs(t_stat)))

        return Correlation(r=r, n=n, p_approx=p_approx, slope=slope, intercept=intercept)

    @staticmethod
    def align_by_day(x: dict[str, float], y: dict[str, float]) -> list[tuple[float, float]]:
        common = sorted(set(x.keys()) & set(y.keys()))
        return [(x[day], y[day]) for day in common]

    @staticmethod
    def lagged(x: dict[str, float], y: dict[str, float], lag_days: int = 1) -> Correlation | None:
        pairs: list[tuple[float, float]] = []
        for day_str, x_val in sorted(x.items()):
            d = datetime.strptime(day_str, "%Y-%m-%d")
            shifted = (d + timedelta(days=lag_days)).strftime("%Y-%m-%d")
            if shifted in y:
                pairs.append((x_val, y[shifted]))
        return CorrelationEngine.pearson(pairs)
