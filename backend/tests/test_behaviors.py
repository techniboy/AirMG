from __future__ import annotations

from airmg.analytics import behaviors


def test_cohens_d_basic():
    """Known large effect: d > 1.0 when groups are clearly separated."""
    with_vals = [80.0, 82.0, 84.0, 86.0, 88.0]
    without_vals = [50.0, 52.0, 54.0, 56.0, 58.0]
    d = behaviors._cohens_d(with_vals, without_vals)
    assert d > 1.0


def test_cohens_d_identical():
    """Same values in both groups → d ≈ 0."""
    vals = [60.0, 62.0, 64.0, 66.0, 68.0]
    d = behaviors._cohens_d(vals, vals)
    assert abs(d) < 0.01


def test_cohens_d_empty():
    """Empty list → d = 0.0 (guard against division by zero)."""
    d = behaviors._cohens_d([], [])
    assert d == 0.0


def test_analyze_returns_ranked_effects():
    """Two behaviors, result sorted by |effect_size| descending."""
    # behavior_a: large effect on metric
    # behavior_b: small effect on metric
    days_a_true = [f"2026-01-{i:02d}" for i in range(1, 11)]  # 10 days
    days_a_false = [f"2026-01-{i:02d}" for i in range(11, 21)]  # 10 days

    # metric: high on a_true days, identical on b days
    metrics: dict[str, float] = {}
    for d in days_a_true:
        metrics[d] = 90.0
    for d in days_a_false:
        metrics[d] = 50.0
    # b_true and b_false overlap with a days, give them tiny difference
    # b_true days already have 90 or 50 from a. Use completely new days for b.
    b_true_days = [f"2026-02-{i:02d}" for i in range(1, 11)]
    b_false_days = [f"2026-02-{i:02d}" for i in range(11, 21)]
    for d in b_true_days:
        metrics[d] = 61.0
    for d in b_false_days:
        metrics[d] = 60.0

    journal: dict[str, dict[str, bool]] = {
        "behavior_a": {d: True for d in days_a_true} | {d: False for d in days_a_false},
        "behavior_b": {d: True for d in b_true_days} | {d: False for d in b_false_days},
    }

    questions = {
        "behavior_a": {"question": "Did you do A?", "category": "sleep"},
        "behavior_b": {"question": "Did you do B?", "category": "sleep"},
    }

    effects = behaviors.analyze(journal, metrics, questions, "Recovery", higher_is_better=True)
    assert len(effects) == 2
    assert abs(effects[0].effect_size) >= abs(effects[1].effect_size)
    assert effects[0].question_key == "behavior_a"


def test_analyze_skips_small_groups():
    """Only 2 'with' days → skip (min group size is 5)."""
    days_true = ["2026-01-01", "2026-01-02"]
    days_false = [f"2026-01-{i:02d}" for i in range(3, 13)]

    metrics: dict[str, float] = {}
    for d in days_true:
        metrics[d] = 90.0
    for d in days_false:
        metrics[d] = 50.0

    journal: dict[str, dict[str, bool]] = {
        "behavior_a": {d: True for d in days_true} | {d: False for d in days_false},
    }
    questions = {"behavior_a": {"question": "Did you do A?", "category": "sleep"}}

    effects = behaviors.analyze(journal, metrics, questions, "Recovery", higher_is_better=True)
    assert effects == []


def test_direction_inverted_for_rhr():
    """higher_is_better=False: higher with-value should yield 'negative' direction."""
    days_true = [f"2026-01-{i:02d}" for i in range(1, 11)]
    days_false = [f"2026-01-{i:02d}" for i in range(11, 21)]

    # Use varied values so pooled SD is non-zero; with-group clearly higher
    with_rhr = [68.0, 70.0, 72.0, 71.0, 69.0, 73.0, 67.0, 74.0, 70.0, 71.0]
    without_rhr = [53.0, 55.0, 57.0, 56.0, 54.0, 58.0, 52.0, 59.0, 55.0, 56.0]

    metrics: dict[str, float] = {}
    for i, d in enumerate(days_true):
        metrics[d] = with_rhr[i]  # higher resting HR on "with" days
    for i, d in enumerate(days_false):
        metrics[d] = without_rhr[i]

    journal: dict[str, dict[str, bool]] = {
        "behavior_rhr": {d: True for d in days_true} | {d: False for d in days_false},
    }
    questions = {"behavior_rhr": {"question": "Did you drink alcohol?", "category": "lifestyle"}}

    effects = behaviors.analyze(journal, metrics, questions, "Resting HR", higher_is_better=False)
    assert len(effects) == 1
    assert effects[0].direction == "negative"
