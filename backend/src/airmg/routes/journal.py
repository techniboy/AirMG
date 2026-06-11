from __future__ import annotations
import time
from fastapi import APIRouter
from pydantic import BaseModel
from airmg.config import DB_PATH
from airmg.journal.catalog import JournalCatalog
from airmg.store.db import get_connection
from airmg.store.reads import get_journal_entries
from airmg.store.writes import upsert_journal_entry

router = APIRouter(prefix="/api/journal", tags=["journal"])

class JournalEntryIn(BaseModel):
    day: str
    question_key: str
    answer: str

@router.get("/catalog")
def catalog():
    return {"questions": JournalCatalog.merge_catalog(imported=[], custom=[])}

@router.get("")
def journal_list(day: str):
    conn = get_connection(DB_PATH)
    entries = get_journal_entries(conn, day)
    conn.close()
    return {"entries": entries}

@router.post("")
def journal_create(entry: JournalEntryIn):
    conn = get_connection(DB_PATH)
    upsert_journal_entry(conn, entry.day, entry.question_key, entry.answer, int(time.time()))
    conn.close()
    return {"status": "ok"}
