from airmg.analytics.zones import HRZone, HRZoneSet, build_zones, time_in_zones


def test_build_zones_from_age():
    zs = build_zones(age=30)
    assert len(zs.zones) == 5
    assert zs.max_hr == 187.0  # Tanaka
    assert zs.zones[0].number == 1
    assert zs.zones[0].lower_pct == 0.50
    assert zs.zones[4].number == 5
    assert zs.zones[4].upper_pct == 1.00


def test_zone_number():
    zs = build_zones(age=30)
    assert zs.zone_number(100.0) == 1  # ~53% of 187
    assert zs.zone_number(175.0) == 5  # ~93% of 187
    assert zs.zone_number(50.0) == 0   # below zone 1


def test_time_in_zones():
    zs = build_zones(age=30)
    samples = [
        {"ts": 0, "value": 100},   # zone 1
        {"ts": 1, "value": 100},   # zone 1
        {"ts": 2, "value": 170},   # zone 4-5
        {"ts": 3, "value": 170},   # zone 4-5
    ]
    result = time_in_zones(zs, samples)
    assert len(result) == 5
    total = sum(result.values())
    assert total == 4  # all samples assigned
