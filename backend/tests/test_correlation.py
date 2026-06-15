from airmg.analytics.correlation import align_by_day, lagged, pearson


def test_perfect_positive_correlation():
    pairs = [(1.0, 2.0), (2.0, 4.0), (3.0, 6.0), (4.0, 8.0), (5.0, 10.0)]
    result = pearson(pairs)
    assert result is not None
    assert abs(result.r - 1.0) < 0.001
    assert abs(result.slope - 2.0) < 0.001
    assert abs(result.intercept - 0.0) < 0.001


def test_perfect_negative_correlation():
    pairs = [(1.0, 10.0), (2.0, 8.0), (3.0, 6.0), (4.0, 4.0), (5.0, 2.0)]
    result = pearson(pairs)
    assert result is not None
    assert abs(result.r - (-1.0)) < 0.001


def test_too_few_pairs_returns_none():
    assert pearson([(1.0, 2.0), (2.0, 4.0)]) is None


def test_zero_variance_returns_none():
    pairs = [(1.0, 5.0), (1.0, 5.0), (1.0, 5.0)]
    assert pearson(pairs) is None


def test_align_by_day():
    x = {"2026-06-01": 50.0, "2026-06-02": 55.0, "2026-06-03": 60.0}
    y = {"2026-06-01": 70.0, "2026-06-03": 80.0}
    result = align_by_day(x, y)
    assert len(result) == 2
    assert result[0] == (50.0, 70.0)
    assert result[1] == (60.0, 80.0)


def test_lagged_correlation():
    x = {"2026-06-01": 10.0, "2026-06-02": 20.0, "2026-06-03": 30.0, "2026-06-04": 40.0}
    y = {"2026-06-02": 15.0, "2026-06-03": 25.0, "2026-06-04": 35.0, "2026-06-05": 45.0}
    result = lagged(x, y, lag_days=1)
    assert result is not None
    assert abs(result.r - 1.0) < 0.001
