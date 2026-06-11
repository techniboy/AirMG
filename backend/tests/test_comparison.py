from airmg.analytics.comparison import ComparisonEngine


def test_compare_periods():
    current = [
        {"day": "2026-06-08", "recovery": 70.0, "strain": 12.0},
        {"day": "2026-06-09", "recovery": 65.0, "strain": 14.0},
        {"day": "2026-06-10", "recovery": 80.0, "strain": 10.0},
    ]
    previous = [
        {"day": "2026-06-01", "recovery": 60.0, "strain": 15.0},
        {"day": "2026-06-02", "recovery": 55.0, "strain": 16.0},
        {"day": "2026-06-03", "recovery": 50.0, "strain": 13.0},
    ]
    result = ComparisonEngine.compare(current, previous, metrics=["recovery", "strain"])
    assert "recovery" in result
    assert result["recovery"]["current_avg"] > result["recovery"]["previous_avg"]
    assert result["recovery"]["delta"] > 0
    assert "strain" in result


def test_compare_empty_returns_none():
    result = ComparisonEngine.compare([], [], metrics=["recovery"])
    assert result["recovery"]["current_avg"] is None


def test_compare_single_metric():
    current = [{"day": "2026-06-10", "recovery": 75.0}]
    previous = [{"day": "2026-06-03", "recovery": 60.0}]
    result = ComparisonEngine.compare(current, previous, metrics=["recovery"])
    assert result["recovery"]["delta"] == 15.0
