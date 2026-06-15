from __future__ import annotations

import sqlite3
import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from airmg.journal.catalog import JOURNAL_QUESTIONS
from airmg.store.db import get_db
from airmg.store.reads import get_journal_entries
from airmg.store.writes import upsert_journal_entry

router = APIRouter(prefix="/api/journal", tags=["journal"])


class JournalEntryIn(BaseModel):
    day: str
    question_id: str
    question: str
    answer: bool


@router.get("/catalog")
def catalog(conn: sqlite3.Connection = Depends(get_db)):
    return {"questions": JOURNAL_QUESTIONS}


@router.get("")
def journal_list(day: str, conn: sqlite3.Connection = Depends(get_db)):
    entries = get_journal_entries(conn, day)
    return {"entries": entries}


@router.post("")
def journal_create(entry: JournalEntryIn, conn: sqlite3.Connection = Depends(get_db)):
    upsert_journal_entry(
        conn, entry.day, entry.question_id, entry.question, entry.answer, int(time.time())
    )
    return {"status": "ok"}
