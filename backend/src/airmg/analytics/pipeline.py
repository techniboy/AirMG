from __future__ import annotations

import sqlite3
from datetime import datetime

from airmg.analytics.baselines import Baselines, BaselineState, BaselineStatus
from airmg.analytics.recovery import RecoveryScorer
from airmg.analytics.strain import StrainScorer
from airmg.store.reads import get_baseline, get_samples_range
from airmg.store.writes import upsert_baseline, upsert_daily_metrics


def _day_ts_range(day: str) -> tuple[int, int]:
    dt = datetime.strptime(day, "%Y-%m-%d")
    start = int(dt.timestamp())
    return start, start + 86400


def _baseline_from_db(conn: sqlite3.Connection, metric: str) -> BaselineState | None:
    row = get_baseline(conn, metric)
    if row is None:
        return None
    return BaselineState(
        baseline=row["mean"],
        spread=row["spread"],
        n_valid=row["n_valid"],
        nights_since_update=row["nights_since_update"],
        status=BaselineStatus(row["status"]),
    )


def _save_baseline(conn: sqlite3.Connection, metric: str, state: BaselineState) -> None:
    upsert_baseline(
        conn,
        metric,
        state.baseline,
        state.spread,
        state.n_valid,
        state.nights_since_update,
        state.status.value,
    )


def compute_daily_metrics(conn: sqlite3.Connection, day: str) -> None:
    start_ts, end_ts = _day_ts_range(day)
    hr_data = get_samples_range(conn, "hr", start_ts, end_ts)
    hrv_data = get_samples_range(conn, "hrv", start_ts - 43200, end_ts)

    nightly_hrv = None
    if hrv_data:
        nightly_hrv = sum(s["value"] for s in hrv_data) / len(hrv_data)

    sleep_row = conn.execute(
        "SELECT * FROM sleep_sessions"
        " WHERE start_ts >= ? AND end_ts <= ?"
        " ORDER BY start_ts DESC LIMIT 1",
        (start_ts - 43200, end_ts),
    ).fetchone()

    resting_hr = None
    sleep_perf = None
    sleep_minutes = None
    deep_minutes = None
    rem_minutes = None
    light_minutes = None
    wake_minutes = None

    if sleep_row:
        resting_hr = sleep_row["resting_hr"]
        sleep_perf = sleep_row["efficiency"]
        if sleep_row["avg_hrv"] and nightly_hrv is None:
            nightly_hrv = sleep_row["avg_hrv"]
        duration = sleep_row["end_ts"] - sleep_row["start_ts"]
        sleep_minutes = duration // 60

    # Update baselines
    hrv_baseline = _baseline_from_db(conn, "hrv")
    hrv_baseline = Baselines.update(hrv_baseline, nightly_hrv, Baselines.HRV_CFG)
    _save_baseline(conn, "hrv", hrv_baseline)

    rhr_baseline = _baseline_from_db(conn, "resting_hr")
    rhr_val = float(resting_hr) if resting_hr else None
    rhr_baseline = Baselines.update(rhr_baseline, rhr_val, Baselines.RHR_CFG)
    _save_baseline(conn, "resting_hr", rhr_baseline)

    # Recovery
    recovery = None
    if nightly_hrv is not None and resting_hr is not None:
        recovery = RecoveryScorer.recovery(
            hrv=nightly_hrv,
            rhr=float(resting_hr),
            resp=None,
            hrv_baseline=hrv_baseline,
            rhr_baseline=rhr_baseline if rhr_baseline.usable else None,
            resp_baseline=None,
            sleep_perf=sleep_perf,
        )

    # Strain
    strain_val = None
    if hr_data:
        rhr_for_strain = float(resting_hr) if resting_hr else StrainScorer.DEFAULT_RESTING_HR
        strain_val = StrainScorer.strain(hr_data, resting_hr=rhr_for_strain, age=30)

    # Steps
    steps_row = conn.execute("SELECT total FROM steps WHERE day = ?", (day,)).fetchone()
    steps = steps_row["total"] if steps_row else None

    upsert_daily_metrics(
        conn,
        {
            "day": day,
            "recovery": recovery,
            "strain": strain_val,
            "sleep_performance": sleep_perf,
            "hrv_rmssd": nightly_hrv,
            "resting_hr": rhr_val,
            "sleep_minutes": sleep_minutes,
            "deep_minutes": deep_minutes,
            "rem_minutes": rem_minutes,
            "light_minutes": light_minutes,
            "wake_minutes": wake_minutes,
            "steps": steps,
        },
    )
