from __future__ import annotations

from typing import ClassVar


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
