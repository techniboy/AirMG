from __future__ import annotations

from dataclasses import dataclass

from airmg.analytics.strain import StrainScorer

ZONE_BANDS = [
    (1, 0.50, 0.60),
    (2, 0.60, 0.70),
    (3, 0.70, 0.80),
    (4, 0.80, 0.90),
    (5, 0.90, 1.00),
]


@dataclass(frozen=True, slots=True)
class HRZone:
    number: int
    lower: float
    upper: float
    lower_pct: float
    upper_pct: float


@dataclass(frozen=True, slots=True)
class HRZoneSet:
    zones: list[HRZone]
    max_hr: float
    source: str

    def zone_number(self, bpm: float) -> int:
        for z in reversed(self.zones):
            if bpm >= z.lower:
                return z.number
        return 0


def build_zones(age: int | None = None, manual_max_hr: float | None = None) -> HRZoneSet:
    if manual_max_hr is not None:
        max_hr = manual_max_hr
        source = "manual"
    elif age is not None:
        max_hr = StrainScorer.tanaka_hrmax(float(age))
        source = "tanaka"
    else:
        max_hr = StrainScorer.tanaka_hrmax(30.0)
        source = "tanaka"

    zones = []
    for num, lo_pct, hi_pct in ZONE_BANDS:
        zones.append(
            HRZone(
                number=num,
                lower=round(max_hr * lo_pct, 1),
                upper=round(max_hr * hi_pct, 1),
                lower_pct=lo_pct,
                upper_pct=hi_pct,
            )
        )
    return HRZoneSet(zones=zones, max_hr=max_hr, source=source)


def time_in_zones(zone_set: HRZoneSet, hr_samples: list[dict]) -> dict[int, int]:
    counts = {z.number: 0 for z in zone_set.zones}
    for s in hr_samples:
        zn = zone_set.zone_number(float(s["value"]))
        if zn > 0:
            counts[zn] += 1
    return counts
