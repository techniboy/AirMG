from __future__ import annotations

import time

from fastapi import APIRouter
from pydantic import BaseModel

from airmg.config import DB_PATH
from airmg.journal.catalog import JOURNAL_QUESTIONS
from airmg.store.db import get_connection
from airmg.store.reads import get_journal_entries
from airmg.store.writes import upsert_journal_entry

router = APIRouter(prefix="/api/journal", tags=["journal"])


class JournalEntryIn(BaseModel):
    day: str
    question_id: str
    question: str
    answer: bool


@router.get("/catalog")
def catalog():
    return {"questions": JOURNAL_QUESTIONS}


@router.get("")
def journal_list(day: str):
    conn = get_connection(DB_PATH)
    entries = get_journal_entries(conn, day)
    conn.close()
    return {"entries": entries}


@router.post("")
def journal_create(entry: JournalEntryIn):
    conn = get_connection(DB_PATH)
    upsert_journal_entry(conn, entry.day, entry.question_id, entry.question, entry.answer, int(time.time()))
    conn.close()
    return {"status": "ok"}
