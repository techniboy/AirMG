from airmg.analytics import strain as strain_calc


def test_tanaka_hrmax():
    assert strain_calc.tanaka_hrmax(30.0) == 187.0
    assert strain_calc.tanaka_hrmax(40.0) == 180.0


def test_pct_hrr_clamped():
    assert strain_calc.pct_hrr(60.0, resting_hr=60.0, hr_reserve=120.0) == 0.0
    assert strain_calc.pct_hrr(180.0, resting_hr=60.0, hr_reserve=120.0) == 100.0
    mid = strain_calc.pct_hrr(120.0, resting_hr=60.0, hr_reserve=120.0)
    assert abs(mid - 50.0) < 0.1


def test_zone_weight_below_50_is_zero():
    w = strain_calc.zone_weight(70.0, resting_hr=60.0, hr_reserve=120.0)
    assert w == 0  # ~8.3% HRR, below zone 1


def test_zone_weight_zone_5():
    w = strain_calc.zone_weight(175.0, resting_hr=60.0, hr_reserve=120.0)
    assert w == 5  # ~95.8% HRR, zone 5


def test_trimp_to_strain_zero():
    assert strain_calc.trimp_to_strain(0) == 0
    assert strain_calc.trimp_to_strain(-10) == 0


def test_trimp_to_strain_max():
    result = strain_calc.trimp_to_strain(7200.0)
    assert abs(result - 21.0) < 0.01


def test_strain_from_samples():
    samples = [{"ts": i, "value": 150} for i in range(700)]
    result = strain_calc.strain(samples, resting_hr=60.0, age=30)
    assert result is not None
    assert 0 < result <= 21.0


def test_strain_too_few_samples():
    samples = [{"ts": i, "value": 150} for i in range(100)]
    result = strain_calc.strain(samples, resting_hr=60.0, age=30)
    assert result is None
