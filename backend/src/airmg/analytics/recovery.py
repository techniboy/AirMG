from __future__ import annotations

import math

from airmg.analytics.baselines import BaselineState

W_HRV = 0.60
W_RHR = 0.20
W_RESP = 0.05
W_SLEEP = 0.15

LOGISTIC_K = 1.6
LOGISTIC_Z0 = -0.20

BAND_RED_MAX = 34.0
BAND_YELLOW_MAX = 67.0

SLEEP_PERF_CENTER = 0.85
SLEEP_PERF_SCALE = 0.12


def z_score(value: float, mean: float, spread: float) -> float:
    sigma = max(1.253 * spread, 1e-9)
    return (value - mean) / sigma


def band(score: float) -> str:
    if score < BAND_RED_MAX:
        return "red"
    if score < BAND_YELLOW_MAX:
        return "yellow"
    return "green"


def recovery(
    hrv: float,
    rhr: float,
    resp: float | None,
    hrv_baseline: BaselineState,
    rhr_baseline: BaselineState | None,
    resp_baseline: BaselineState | None,
    sleep_perf: float | None,
) -> float | None:
    if not hrv_baseline.usable:
        return None

    terms: list[tuple[float, float]] = []

    # HRV: higher is better
    terms.append(
        (
            z_score(hrv, hrv_baseline.baseline, hrv_baseline.spread),
            W_HRV,
        )
    )

    # RHR: lower is better → invert
    if rhr_baseline is not None:
        terms.append(
            (
                z_score(rhr_baseline.baseline, rhr, rhr_baseline.spread),
                W_RHR,
            )
        )

    # Resp: lower is better, optional
    if resp is not None and resp_baseline is not None:
        terms.append(
            (
                z_score(resp_baseline.baseline, resp, resp_baseline.spread),
                W_RESP,
            )
        )

    # Sleep perf: centered at 0.85, no baseline
    if sleep_perf is not None:
        terms.append(
            (
                (sleep_perf - SLEEP_PERF_CENTER) / SLEEP_PERF_SCALE,
                W_SLEEP,
            )
        )

    if not terms:
        return None

    total_weight = sum(w for _, w in terms)
    if total_weight <= 0:
        return None

    z = sum(zi * wi for zi, wi in terms) / total_weight
    score = 100.0 / (1.0 + math.exp(-LOGISTIC_K * (z - LOGISTIC_Z0)))
    return max(0.0, min(100.0, score))
