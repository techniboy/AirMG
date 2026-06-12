from __future__ import annotations

import json
import sqlite3
from datetime import datetime

from airmg.analytics.baselines import Baselines, BaselineState, BaselineStatus
from airmg.analytics.recovery import RecoveryScorer
from airmg.analytics.sleep_score import compute_sleep_score
from airmg.analytics.strain import StrainScorer
from airmg.store.reads import get_baseline, get_samples_range
from airmg.store.writes import upsert_baseline, upsert_daily_metrics, upsert_steps


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
    hrv_data = get_samples_range(conn, "hrv", start_ts - 43200, start_ts + 43200)

    nightly_hrv = None
    if hrv_data:
        nightly_hrv = sum(s["value"] for s in hrv_data) / len(hrv_data)

    sleep_row = conn.execute(
        "SELECT * FROM sleep_sessions"
        " WHERE end_ts > ? AND end_ts <= ?"
        " AND (end_ts - start_ts) >= 3600"
        " ORDER BY (end_ts - start_ts) DESC LIMIT 1",
        (start_ts, end_ts + 43200),
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
        if not resting_hr:
            sleep_hr = get_samples_range(
                conn, "hr", sleep_row["start_ts"], sleep_row["end_ts"]
            )
            if sleep_hr:
                values = sorted(s["value"] for s in sleep_hr)
                p5_idx = max(0, len(values) * 5 // 100)
                resting_hr = round(values[p5_idx])
        sleep_perf = sleep_row["efficiency"]
        if sleep_row["avg_hrv"] and nightly_hrv is None:
            nightly_hrv = sleep_row["avg_hrv"]
        duration = sleep_row["end_ts"] - sleep_row["start_ts"]
        sleep_minutes = duration // 60

        if sleep_row["stages_json"]:
            try:
                stages = json.loads(sleep_row["stages_json"])
                for stage_entry in stages:
                    stage_name = stage_entry.get("stage", "")
                    stage_dur = 0
                    if "start" in stage_entry and "end" in stage_entry:
                        stage_dur = (stage_entry["end"] - stage_entry["start"]) // 60
                    elif "minutes" in stage_entry:
                        stage_dur = stage_entry["minutes"]
                    if stage_name == "deep":
                        deep_minutes = (deep_minutes or 0) + stage_dur
                    elif stage_name == "rem":
                        rem_minutes = (rem_minutes or 0) + stage_dur
                    elif stage_name == "light":
                        light_minutes = (light_minutes or 0) + stage_dur
                    elif stage_name in ("wake", "awake"):
                        wake_minutes = (wake_minutes or 0) + stage_dur
            except (json.JSONDecodeError, TypeError):
                pass

    # SpO2 — wrist sensors produce noisy low readings; discard below 85% and use median
    spo2_vals = sorted(s["value"] for s in get_samples_range(conn, "spo2", start_ts, end_ts) if s["value"] >= 85)
    spo2 = None
    if spo2_vals:
        mid = len(spo2_vals) // 2
        spo2 = round(spo2_vals[mid] if len(spo2_vals) % 2 else (spo2_vals[mid - 1] + spo2_vals[mid]) / 2, 1)

    # Resp rate
    resp_data = get_samples_range(conn, "resp_rate", start_ts, end_ts)
    resp_rate = None
    if resp_data:
        resp_rate = round(sum(s["value"] for s in resp_data) / len(resp_data), 1)

    # Calories from workouts
    workout_rows = conn.execute(
        "SELECT calories FROM workouts WHERE start_ts >= ? AND start_ts < ?",
        (start_ts, end_ts),
    ).fetchall()
    cal_vals = [r["calories"] for r in workout_rows if r["calories"] is not None]
    calories = round(sum(cal_vals)) if cal_vals else None

    # Update baselines
    hrv_baseline = _baseline_from_db(conn, "hrv")
    hrv_baseline = Baselines.update(hrv_baseline, nightly_hrv, Baselines.HRV_CFG)
    _save_baseline(conn, "hrv", hrv_baseline)

    rhr_baseline = _baseline_from_db(conn, "resting_hr")
    rhr_val = float(resting_hr) if resting_hr else None
    rhr_baseline = Baselines.update(rhr_baseline, rhr_val, Baselines.RHR_CFG)
    _save_baseline(conn, "resting_hr", rhr_baseline)

    # Sleep score (composite: duration + efficiency + architecture + autonomic)
    if sleep_minutes and sleep_minutes > 0:
        ss = compute_sleep_score(
            sleep_min=sleep_minutes,
            efficiency=sleep_perf,
            deep_min=deep_minutes,
            rem_min=rem_minutes,
            hrv=nightly_hrv,
            rhr=rhr_val,
            hrv_baseline=hrv_baseline.baseline if hrv_baseline.usable else None,
            hrv_spread=hrv_baseline.spread if hrv_baseline.usable else None,
            rhr_baseline=rhr_baseline.baseline if rhr_baseline.usable else None,
            rhr_spread=rhr_baseline.spread if rhr_baseline.usable else None,
        )
        sleep_perf = ss.total / 100.0

    # Resp baseline
    resp_baseline = _baseline_from_db(conn, "resp_rate")
    resp_baseline = Baselines.update(resp_baseline, resp_rate, Baselines.RESP_CFG)
    _save_baseline(conn, "resp_rate", resp_baseline)

    # Recovery
    recovery = None
    if nightly_hrv is not None and resting_hr is not None:
        recovery = RecoveryScorer.recovery(
            hrv=nightly_hrv,
            rhr=float(resting_hr),
            resp=resp_rate,
            hrv_baseline=hrv_baseline,
            rhr_baseline=rhr_baseline if rhr_baseline.usable else None,
            resp_baseline=resp_baseline if resp_baseline.usable else None,
            sleep_perf=sleep_perf,
        )

    # Strain
    strain_val = None
    if hr_data:
        rhr_for_strain = float(resting_hr) if resting_hr else StrainScorer.DEFAULT_RESTING_HR
        strain_val = StrainScorer.strain(hr_data, resting_hr=rhr_for_strain, age=30)

    # Steps — aggregate from deduplicated interval samples
    step_samples = get_samples_range(conn, "steps", start_ts, end_ts)
    steps = int(sum(s["value"] for s in step_samples)) if step_samples else None
    if steps:
        upsert_steps(conn, day, steps)

    upsert_daily_metrics(
        conn,
        {
            "day": day,
            "recovery": recovery,
            "strain": strain_val,
            "sleep_performance": sleep_perf,
            "hrv_rmssd": nightly_hrv,
            "resting_hr": rhr_val,
            "resp_rate": resp_rate,
            "sleep_minutes": sleep_minutes,
            "deep_minutes": deep_minutes,
            "rem_minutes": rem_minutes,
            "light_minutes": light_minutes,
            "wake_minutes": wake_minutes,
            "steps": steps,
            "spo2": spo2,
            "calories": calories,
        },
    )
