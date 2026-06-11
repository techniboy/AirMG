from airmg.analytics.baselines import (
    MetricCfg,
    BaselineState,
    BaselineStatus,
    Baselines,
)


HRV_CFG = MetricCfg(min_val=5.0, max_val=250.0, floor_spread=5.0, half_life_b=14.0, half_life_s=21.0)


def test_first_night_seeds_baseline():
    state = Baselines.update(None, 50.0, HRV_CFG)
    assert state.baseline == 50.0
    assert state.spread == 5.0
    assert state.n_valid == 1
    assert state.status == BaselineStatus.CALIBRATING


def test_missing_night_skips_and_holds():
    state = Baselines.update(None, 50.0, HRV_CFG)
    state2 = Baselines.update(state, None, HRV_CFG)
    assert state2.baseline == 50.0
    assert state2.n_valid == 1
    assert state2.nights_since_update == 1


def test_out_of_range_rejected():
    state = Baselines.update(None, 50.0, HRV_CFG)
    state2 = Baselines.update(state, 300.0, HRV_CFG)  # above max_val
    assert state2.n_valid == 1  # not incremented


def test_becomes_provisional_at_seed():
    state = None
    for i in range(4):
        state = Baselines.update(state, 50.0 + i, HRV_CFG)
    assert state.status == BaselineStatus.PROVISIONAL
    assert state.n_valid == 4


def test_becomes_trusted_at_14():
    state = None
    for i in range(14):
        state = Baselines.update(state, 50.0 + (i % 5), HRV_CFG)
    assert state.status == BaselineStatus.TRUSTED
    assert state.n_valid == 14


def test_hard_outlier_rejected_after_seed():
    state = None
    for i in range(5):
        state = Baselines.update(state, 50.0, HRV_CFG)
    spread = state.spread
    outlier = state.baseline + 6 * spread  # > 5 * spread
    state2 = Baselines.update(state, outlier, HRV_CFG)
    assert state2.n_valid == state.n_valid  # not folded


def test_winsorization_clamps():
    state = None
    for i in range(5):
        state = Baselines.update(state, 50.0, HRV_CFG)
    before = state.baseline
    clamped_val = state.baseline + 2.5 * state.spread  # within 3x, will be Winsorized
    state2 = Baselines.update(state, clamped_val, HRV_CFG)
    assert state2.baseline > before
    assert state2.n_valid == state.n_valid + 1


def test_lambda_half_life():
    lam = Baselines.lambda_half_life(14.0)
    # After 14 applications of (1 - lam), weight should be ~0.5
    remaining = (1 - lam) ** 14
    assert abs(remaining - 0.5) < 0.001
