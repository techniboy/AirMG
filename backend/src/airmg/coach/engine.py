from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Recommendation:
    category: str
    message: str
    priority: int  # 1=high, 2=medium, 3=low


class CoachEngine:
    BAND_RED_MAX = 34.0
    BAND_YELLOW_MAX = 67.0
    SLEEP_DEBT_THRESHOLD = 0.70
    HIGH_STRAIN_THRESHOLD = 15.0

    @staticmethod
    def recommendations(
        recovery: float | None = None,
        strain: float | None = None,
        sleep_perf: float | None = None,
    ) -> list[Recommendation]:
        recs: list[Recommendation] = []

        if recovery is None and strain is None and sleep_perf is None:
            return recs

        if recovery is not None:
            if recovery < CoachEngine.BAND_RED_MAX:
                recs.append(
                    Recommendation(
                        category="recovery",
                        message=(
                            "Recovery is in the red zone."
                            " Focus on rest and active recovery today."
                            " Avoid intense training."
                        ),
                        priority=1,
                    )
                )
            elif recovery < CoachEngine.BAND_YELLOW_MAX:
                recs.append(
                    Recommendation(
                        category="recovery",
                        message=(
                            "Recovery is moderate."
                            " Light to moderate training is appropriate."
                            " Listen to your body."
                        ),
                        priority=2,
                    )
                )
            else:
                recs.append(
                    Recommendation(
                        category="recovery",
                        message=(
                            "Recovery is green."
                            " Your body is ready to push —"
                            " high intensity training is appropriate today."
                        ),
                        priority=3,
                    )
                )

        if sleep_perf is not None and sleep_perf < CoachEngine.SLEEP_DEBT_THRESHOLD:
            recs.append(
                Recommendation(
                    category="sleep",
                    message=(
                        f"Sleep performance is low ({sleep_perf:.0%})."
                        " Prioritize an earlier bedtime tonight"
                        " to reduce sleep debt."
                    ),
                    priority=1,
                )
            )

        if (
            strain is not None
            and recovery is not None
            and strain > CoachEngine.HIGH_STRAIN_THRESHOLD
            and recovery < CoachEngine.BAND_YELLOW_MAX
        ):
                recs.append(
                    Recommendation(
                        category="strain",
                        message=(
                            "High strain on incomplete recovery."
                            " Consider reducing intensity tomorrow"
                            " to avoid overtraining."
                        ),
                        priority=1,
                    )
                )

        recs.sort(key=lambda r: r.priority)
        return recs
