from __future__ import annotations

from typing import ClassVar

JOURNAL_QUESTIONS: list[dict] = [
    {"id": "alcohol", "question": "Did you drink any alcohol?", "category": "lifestyle"},
    {"id": "caffeine_late", "question": "Did you have caffeine late in the day?", "category": "lifestyle"},
    {"id": "screen_in_bed", "question": "Did you view a screen in bed?", "category": "sleep"},
    {"id": "late_meal", "question": "Did you eat close to bedtime?", "category": "sleep"},
    {"id": "stressed", "question": "Did you feel stressed?", "category": "recovery"},
    {"id": "sauna", "question": "Did you use a sauna?", "category": "recovery"},
    {"id": "shared_bed", "question": "Did you share your bed?", "category": "sleep"},
    {"id": "sick", "question": "Did you feel sick or ill?", "category": "health"},
    {"id": "magnesium", "question": "Did you take magnesium?", "category": "lifestyle"},
    {"id": "read_before_bed", "question": "Did you read before bed?", "category": "sleep"},
]


class JournalCatalog:
    STARTER_QUESTIONS: ClassVar[list[str]] = [
        "Did you drink any alcohol?",
        "Did you have caffeine late in the day?",
        "Did you view a screen in bed?",
        "Did you eat close to bedtime?",
        "Did you feel stressed?",
        "Did you use a sauna?",
        "Did you share your bed?",
        "Did you feel sick or ill?",
        "Did you take magnesium?",
        "Did you read before bed?",
    ]

    @staticmethod
    def merge_catalog(imported: list[str], custom: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for q in imported + JournalCatalog.STARTER_QUESTIONS + custom:
            t = q.strip()
            if t and t.lower() not in seen:
                seen.add(t.lower())
                out.append(t)
        return out
