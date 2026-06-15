from airmg.analytics import recovery as recovery_calc
from airmg.analytics.baselines import BaselineState, BaselineStatus


def _make_baseline(mean: float, spread: float, n_valid: int = 14) -> BaselineState:
    return BaselineState(
        baseline=mean,
        spread=spread,
        n_valid=n_valid,
        nights_since_update=0,
        status=BaselineStatus.TRUSTED,
    )


def test_z_score():
    z = recovery_calc.z_score(60.0, mean=50.0, spread=8.0)
    expected = (60.0 - 50.0) / (1.253 * 8.0)
    assert abs(z - expected) < 0.001


def test_recovery_at_baseline_near_58():
    hrv_b = _make_baseline(50.0, 8.0)
    rhr_b = _make_baseline(60.0, 3.0)
    score = recovery_calc.recovery(
        hrv=50.0,
        rhr=60.0,
        resp=None,
        hrv_baseline=hrv_b,
        rhr_baseline=rhr_b,
        resp_baseline=None,
        sleep_perf=0.85,
    )
    assert score is not None
    assert 50.0 < score < 66.0  # near population mean


def test_high_hrv_high_recovery():
    hrv_b = _make_baseline(50.0, 8.0)
    rhr_b = _make_baseline(60.0, 3.0)
    score = recovery_calc.recovery(
        hrv=75.0,
        rhr=50.0,
        resp=None,
        hrv_baseline=hrv_b,
        rhr_baseline=rhr_b,
        resp_baseline=None,
        sleep_perf=0.95,
    )
    assert score is not None
    assert score > 80.0


def test_low_hrv_low_recovery():
    hrv_b = _make_baseline(50.0, 8.0)
    rhr_b = _make_baseline(60.0, 3.0)
    score = recovery_calc.recovery(
        hrv=25.0,
        rhr=75.0,
        resp=None,
        hrv_baseline=hrv_b,
        rhr_baseline=rhr_b,
        resp_baseline=None,
        sleep_perf=0.60,
    )
    assert score is not None
    assert score < 30.0


def test_cold_start_returns_none():
    hrv_b = BaselineState(
        baseline=50.0,
        spread=8.0,
        n_valid=2,
        nights_since_update=0,
        status=BaselineStatus.CALIBRATING,
    )
    score = recovery_calc.recovery(
        hrv=50.0,
        rhr=60.0,
        resp=None,
        hrv_baseline=hrv_b,
        rhr_baseline=None,
        resp_baseline=None,
        sleep_perf=None,
    )
    assert score is None


def test_band_classification():
    assert recovery_calc.band(20.0) == "red"
    assert recovery_calc.band(50.0) == "yellow"
    assert recovery_calc.band(80.0) == "green"


def test_missing_drivers_renormalize():
    hrv_b = _make_baseline(50.0, 8.0)
    score = recovery_calc.recovery(
        hrv=50.0,
        rhr=60.0,
        resp=None,
        hrv_baseline=hrv_b,
        rhr_baseline=None,
        resp_baseline=None,
        sleep_perf=None,
    )
    assert score is not None  # works with HRV only
