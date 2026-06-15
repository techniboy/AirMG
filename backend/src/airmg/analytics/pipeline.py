from __future__ import annotations

import json
import sqlite3
from datetime import datetime

from airmg.analytics import recovery as recovery_calc
from airmg.analytics import strain as strain_calc
from airmg.analytics.baselines import Baselines, BaselineState, BaselineStatus
from airmg.analytics.sleep_score import compute_sleep_score
from airmg.store.reads import get_baseline, get_profile, get_samples_range
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


def _save_baseline(conn: sqlite3.Connection, metric: str, state: BaselineState, day: str) -> None:
    upsert_baseline(
        conn,
        metric,
        state.baseline,
        state.spread,
        state.n_valid,
        state.nights_since_update,
        state.status.value,
        last_day=day,
    )


def _fold_baseline(
    conn: sqlite3.Connection, metric: str, value: float | None, cfg, day: str
) -> None:
    """Fold a night's value into the EWMA baseline, forward-only.

    A day is folded at most once: recompute/re-sync of an already-folded day is
    a no-op, so baselines don't drift from repeated runs over the same range.
    """
    row = get_baseline(conn, metric)
    last_day = row["last_day"] if row else None
    if last_day is not None and day <= last_day:
        return
    state = _baseline_from_db(conn, metric)
    _save_baseline(conn, metric, Baselines.update(state, value, cfg), day)


def recompute_strain_history(conn: sqlite3.Connection) -> int:
    """Recompute strain for all days using the current profile (age / hr_max).

    Strain-only on purpose: a full compute_daily_metrics replay would re-fold
    historical values into the EWMA baselines.
    """
    age = int(get_profile(conn, "age") or strain_calc.DEFAULT_AGE)
    hr_max_str = get_profile(conn, "hr_max")
    max_hr = float(hr_max_str) if hr_max_str else None

    updated = 0
    rows = conn.execute("SELECT day, resting_hr FROM daily_metrics").fetchall()
    for row in rows:
        start_ts, end_ts = _day_ts_range(row["day"])
        hr_data = get_samples_range(conn, "hr", start_ts, end_ts)
        if not hr_data:
            continue
        rhr = float(row["resting_hr"]) if row["resting_hr"] else strain_calc.DEFAULT_RESTING_HR
        strain_val = strain_calc.strain(hr_data, resting_hr=rhr, age=age, max_hr=max_hr)
        conn.execute("UPDATE daily_metrics SET strain = ? WHERE day = ?", (strain_val, row["day"]))
        updated += 1
    conn.commit()
    return updated


def compute_daily_metrics(conn: sqlite3.Connection, day: str) -> None:
    start_ts, end_ts = _day_ts_range(day)
    hr_data = get_samples_range(conn, "hr", start_ts, end_ts)
    hrv_data = get_samples_range(conn, "hrv", start_ts - 43200, start_ts + 43200)

    nightly_hrv = None
    if hrv_data:
        nightly_hrv = sum(s["value"] for s in hrv_data) / len(hrv_data)

    # A sleep session belongs to the day it ends on (the wake day) — no
    # spill-over margin, or tomorrow's longer night gets picked for today.
    sleep_row = conn.execute(
        "SELECT * FROM sleep_sessions"
        " WHERE end_ts > ? AND end_ts <= ?"
        " AND (end_ts - start_ts) >= 3600"
        " ORDER BY (end_ts - start_ts) DESC LIMIT 1",
        (start_ts, end_ts),
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
            sleep_hr = get_samples_range(conn, "hr", sleep_row["start_ts"], sleep_row["end_ts"])
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
    spo2_vals = sorted(
        s["value"] for s in get_samples_range(conn, "spo2", start_ts, end_ts) if s["value"] >= 85
    )
    spo2 = None
    if spo2_vals:
        mid = len(spo2_vals) // 2
        spo2 = round(
            spo2_vals[mid] if len(spo2_vals) % 2 else (spo2_vals[mid - 1] + spo2_vals[mid]) / 2, 1
        )

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

    # Score today against the baseline as it stood *before* today's data,
    # then fold today's values in afterwards — otherwise today's value pulls
    # the baseline toward itself and damps its own z-score.
    hrv_baseline = _baseline_from_db(conn, "hrv")
    rhr_baseline = _baseline_from_db(conn, "resting_hr")
    resp_baseline = _baseline_from_db(conn, "resp_rate")
    rhr_val = float(resting_hr) if resting_hr else None

    hrv_usable = hrv_baseline is not None and hrv_baseline.usable
    rhr_usable = rhr_baseline is not None and rhr_baseline.usable
    resp_usable = resp_baseline is not None and resp_baseline.usable

    # Sleep score (composite: duration + efficiency + architecture + autonomic)
    if sleep_minutes and sleep_minutes > 0:
        ss = compute_sleep_score(
            sleep_min=sleep_minutes,
            efficiency=sleep_perf,
            deep_min=deep_minutes,
            rem_min=rem_minutes,
            hrv=nightly_hrv,
            rhr=rhr_val,
            hrv_baseline=hrv_baseline.baseline if hrv_usable else None,
            hrv_spread=hrv_baseline.spread if hrv_usable else None,
            rhr_baseline=rhr_baseline.baseline if rhr_usable else None,
            rhr_spread=rhr_baseline.spread if rhr_usable else None,
        )
        sleep_perf = ss.total / 100.0

    # Recovery
    recovery = None
    if nightly_hrv is not None and resting_hr is not None and hrv_baseline is not None:
        recovery = recovery_calc.recovery(
            hrv=nightly_hrv,
            rhr=float(resting_hr),
            resp=resp_rate,
            hrv_baseline=hrv_baseline,
            rhr_baseline=rhr_baseline if rhr_usable else None,
            resp_baseline=resp_baseline if resp_usable else None,
            sleep_perf=sleep_perf,
        )

    # Fold today's values into the baselines for tomorrow (forward-only — a
    # day already folded is skipped, so re-syncs don't double-count).
    _fold_baseline(conn, "hrv", nightly_hrv, Baselines.HRV_CFG, day)
    _fold_baseline(conn, "resting_hr", rhr_val, Baselines.RHR_CFG, day)
    _fold_baseline(conn, "resp_rate", resp_rate, Baselines.RESP_CFG, day)

    # Strain — use profile age / manual HR max when set
    strain_val = None
    if hr_data:
        rhr_for_strain = float(resting_hr) if resting_hr else strain_calc.DEFAULT_RESTING_HR
        age = int(get_profile(conn, "age") or strain_calc.DEFAULT_AGE)
        hr_max_str = get_profile(conn, "hr_max")
        max_hr = float(hr_max_str) if hr_max_str else None
        strain_val = strain_calc.strain(hr_data, resting_hr=rhr_for_strain, age=age, max_hr=max_hr)

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
