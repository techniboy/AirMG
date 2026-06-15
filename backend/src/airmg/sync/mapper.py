from __future__ import annotations

import json
from datetime import datetime


def _parse_ts(iso_str: str | None) -> int:
    if not iso_str:
        return 0
    return int(datetime.fromisoformat(iso_str.replace("Z", "+00:00")).timestamp())


def map_heart_rate(data_points: list[dict]) -> list[dict]:
    samples = []
    for dp in data_points:
        hr = dp.get("heartRate")
        if not hr:
            continue
        ts = _parse_ts(hr.get("sampleTime", {}).get("physicalTime"))
        bpm = hr.get("beatsPerMinute")
        if bpm is not None:
            samples.append({"type": "hr", "ts": ts, "value": float(bpm)})
    return samples


def _parse_date_obj(date_obj: dict | str | None) -> int:
    if not date_obj:
        return 0
    if isinstance(date_obj, str):
        return _parse_ts(date_obj)
    y = date_obj.get("year", 2000)
    m = date_obj.get("month", 1)
    d = date_obj.get("day", 1)
    return int(datetime(y, m, d).timestamp())


def map_hrv(data_points: list[dict]) -> list[dict]:
    samples = []
    for dp in data_points:
        hrv = dp.get("dailyHeartRateVariability") or dp.get("heartRateVariability")
        if not hrv:
            continue
        ts = _parse_date_obj(hrv.get("date")) or _parse_ts(
            hrv.get("sampleTime", {}).get("physicalTime")
        )
        rmssd = hrv.get("averageHeartRateVariabilityMilliseconds") or hrv.get(
            "deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds"
        )
        if rmssd is not None:
            samples.append({"type": "hrv", "ts": ts, "value": float(rmssd)})
    return samples


def map_sleep_sessions(data_points: list[dict]) -> list[dict]:
    sessions = []
    for dp in data_points:
        sleep = dp.get("sleep")
        if not sleep:
            continue
        interval = sleep.get("interval", {})
        start = _parse_ts(interval.get("startTime"))
        end = _parse_ts(interval.get("endTime"))
        if start == 0 or end == 0:
            continue
        stages = []
        for s in sleep.get("stages", []):
            stages.append(
                {
                    "start": _parse_ts(s.get("startTime")),
                    "end": _parse_ts(s.get("endTime")),
                    "stage": _map_sleep_stage(s.get("type", "")),
                }
            )
        summary = sleep.get("summary", {})
        mins_asleep = int(summary.get("minutesAsleep", 0))
        mins_awake = int(summary.get("minutesAwake", 0))
        total = mins_asleep + mins_awake
        efficiency = mins_asleep / total if total > 0 else None
        sessions.append(
            {
                "start_ts": start,
                "end_ts": end,
                "efficiency": efficiency,
                "stages_json": json.dumps(stages) if stages else None,
            }
        )
    return sessions


def map_workouts(data_points: list[dict]) -> list[dict]:
    workouts = []
    for dp in data_points:
        ex = dp.get("exercise")
        if not ex:
            continue
        interval = ex.get("interval", {})
        start = _parse_ts(interval.get("startTime"))
        end = _parse_ts(interval.get("endTime"))
        metrics = ex.get("metricsSummary", {})
        workouts.append(
            {
                "start_ts": start,
                "end_ts": end,
                "workout_type": ex.get("exerciseType"),
                "calories": metrics.get("caloriesKcal"),
                "avg_hr": (
                    int(metrics["averageHeartRateBeatsPerMinute"])
                    if metrics.get("averageHeartRateBeatsPerMinute")
                    else None
                ),
            }
        )
    return workouts


def map_spo2(data_points: list[dict]) -> list[dict]:
    samples = []
    for dp in data_points:
        ox = dp.get("oxygenSaturation") or dp.get("dailyOxygenSaturation")
        if not ox:
            continue
        ts = _parse_ts(ox.get("sampleTime", {}).get("physicalTime") or ox.get("date"))
        pct = ox.get("oxygenSaturationPercent") or ox.get("percentage")
        if pct is not None:
            samples.append({"type": "spo2", "ts": ts, "value": float(pct)})
    return samples


def map_resp_rate(data_points: list[dict]) -> list[dict]:
    samples = []
    for dp in data_points:
        rr = dp.get("respiratoryRate") or dp.get("dailyRespiratoryRate")
        if not rr:
            continue
        ts = _parse_ts(rr.get("sampleTime", {}).get("physicalTime")) or _parse_date_obj(
            rr.get("date")
        )
        rpm = rr.get("breathsPerMinute") or rr.get("respiratoryRateBreathsPerMinute")
        if rpm is not None:
            samples.append({"type": "resp_rate", "ts": ts, "value": float(rpm)})
    return samples


def map_steps(data_points: list[dict]) -> list[dict]:
    steps = []
    for dp in data_points:
        s = dp.get("steps")
        if not s:
            continue
        interval = s.get("interval", {})
        start = _parse_ts(interval.get("startTime"))
        end = _parse_ts(interval.get("endTime"))
        count = s.get("stepCount") or s.get("count")
        if count is not None and start and end:
            steps.append({"ts": start, "end_ts": end, "value": int(count)})
    return steps


def _map_sleep_stage(stage_str: str) -> str:
    mapping = {
        "AWAKE": "wake",
        "LIGHT": "light",
        "DEEP": "deep",
        "REM": "rem",
        "ASLEEP": "light",
        "RESTLESS": "wake",
    }
    return mapping.get(stage_str, "light")
