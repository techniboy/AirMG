from datetime import datetime

import airmg.analytics.pipeline as pipeline
from airmg.routes.sync import _recompute_metrics


def test_recompute_window_includes_partial_end_day(monkeypatch):
    """Overnight sync (last night -> this morning) must still recompute today.

    Regression: `(end - start).days` floored to 0 and dropped the end day.
    """
    seen: list[str] = []
    monkeypatch.setattr(pipeline, "compute_daily_metrics", lambda conn, day: seen.append(day))

    _recompute_metrics(None, datetime(2026, 6, 12, 18, 0), datetime(2026, 6, 13, 10, 19))

    assert seen == ["2026-06-12", "2026-06-13"]
