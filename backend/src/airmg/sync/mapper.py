from __future__ import annotations

import json


def map_heart_rate(data_points: list[dict]) -> list[dict]:
    samples = []
    for dp in data_points:
        ts = int(dp.get("startTime", "0").rstrip("s"))
        for val in dp.get("values", []):
            if "fpVal" in val:
                samples.append({"type": "hr", "ts": ts, "value": val["fpVal"]})
            elif "intVal" in val:
                samples.append({"type": "hr", "ts": ts, "value": float(val["intVal"])})
    return samples


def map_hrv(data_points: list[dict]) -> list[dict]:
    samples = []
    for dp in data_points:
        ts = int(dp.get("startTime", "0").rstrip("s"))
        for val in dp.get("values", []):
            if "fpVal" in val:
                samples.append({"type": "hrv", "ts": ts, "value": val["fpVal"]})
    return samples


def map_sleep_sessions(data_points: list[dict]) -> list[dict]:
    sessions = []
    for dp in data_points:
        start = int(dp.get("startTime", "0").rstrip("s"))
        end = int(dp.get("endTime", "0").rstrip("s"))
        stages = []
        for val in dp.get("values", []):
            if "mapVal" in val:
                for entry in val["mapVal"]:
                    stages.append(
                        {
                            "start": int(entry.get("startTime", "0").rstrip("s")),
                            "end": int(entry.get("endTime", "0").rstrip("s")),
                            "stage": _map_sleep_stage(entry.get("value", {}).get("intVal", 0)),
                        }
                    )
        duration = end - start
        wake_time = sum(s["end"] - s["start"] for s in stages if s["stage"] == "wake")
        efficiency = (duration - wake_time) / duration if duration > 0 else 0.0
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
        start = int(dp.get("startTime", "0").rstrip("s"))
        end = int(dp.get("endTime", "0").rstrip("s"))
        workout_type = None
        calories = None
        for val in dp.get("values", []):
            if "stringVal" in val:
                workout_type = val["stringVal"]
            if "fpVal" in val and workout_type is None:
                calories = val["fpVal"]
        workouts.append(
            {
                "start_ts": start,
                "end_ts": end,
                "type": workout_type,
                "calories": calories,
            }
        )
    return workouts


def map_spo2(data_points: list[dict]) -> list[dict]:
    return [
        {
            "type": "spo2",
            "ts": int(dp.get("startTime", "0").rstrip("s")),
            "value": dp["values"][0]["fpVal"],
        }
        for dp in data_points
        if dp.get("values")
    ]


def map_steps(data_points: list[dict]) -> list[dict]:
    steps = []
    for dp in data_points:
        for val in dp.get("values", []):
            if "intVal" in val:
                steps.append(
                    {"ts": int(dp.get("startTime", "0").rstrip("s")), "value": val["intVal"]}
                )
    return steps


def _map_sleep_stage(stage_int: int) -> str:
    mapping = {1: "wake", 2: "light", 3: "deep", 4: "rem", 5: "light", 6: "wake"}
    return mapping.get(stage_int, "light")
