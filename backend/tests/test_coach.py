from airmg.coach.engine import recommendations
from airmg.journal import catalog


def test_starter_questions_exist():
    assert len(catalog.STARTER_QUESTIONS) == 10
    assert "Did you drink any alcohol?" in catalog.STARTER_QUESTIONS


def test_merge_catalog_dedupes():
    custom = ["Did you drink any alcohol?", "Did you meditate?"]
    result = catalog.merge_catalog(imported=[], custom=custom)
    alcohol_count = sum(1 for q in result if q.lower() == "did you drink any alcohol?")
    assert alcohol_count == 1
    assert "Did you meditate?" in result


def test_red_recovery_recommends_rest():
    recs = recommendations(recovery=25.0, strain=5.0, sleep_perf=0.70)
    assert any(r.category == "recovery" for r in recs)
    assert any("rest" in r.message.lower() or "recover" in r.message.lower() for r in recs)


def test_green_recovery_recommends_push():
    recs = recommendations(recovery=80.0, strain=5.0, sleep_perf=0.90)
    assert any("train" in r.message.lower() or "push" in r.message.lower() for r in recs)


def test_sleep_debt_alert():
    recs = recommendations(recovery=50.0, strain=10.0, sleep_perf=0.55)
    assert any("sleep" in r.message.lower() for r in recs)


def test_no_data_returns_empty():
    recs = recommendations(recovery=None, strain=None, sleep_perf=None)
    assert len(recs) == 0
