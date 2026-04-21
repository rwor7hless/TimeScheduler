from datetime import date

from prompts.pet_personas import PERSONAS, pick_persona


def test_pick_persona_returns_known_id():
    pid = pick_persona(
        user_id=1, today=date(2026, 4, 21),
        tasks_count=3, overdue_count=0, deadline_today_count=0, hour=12,
    )
    assert pid in PERSONAS


def test_pick_persona_deterministic_for_same_user_and_date():
    args = dict(
        user_id=42, today=date(2026, 4, 21),
        tasks_count=2, overdue_count=0, deadline_today_count=0, hour=10,
    )
    a = pick_persona(**args)
    b = pick_persona(**args)
    assert a == b


def test_pick_persona_differs_across_days():
    ids = {
        pick_persona(
            user_id=7, today=date(2026, 4, d),
            tasks_count=2, overdue_count=0, deadline_today_count=0, hour=12,
        )
        for d in range(1, 31)
    }
    # За 30 дней должно встретиться больше одной персоны.
    assert len(ids) > 1


def test_overdue_boosts_suhar():
    counts: dict[str, int] = {}
    for uid in range(200):
        pid = pick_persona(
            user_id=uid, today=date(2026, 4, 21),
            tasks_count=3, overdue_count=5, deadline_today_count=0, hour=12,
        )
        counts[pid] = counts.get(pid, 0) + 1
    assert counts.get("suhar", 0) / 200 > 0.35


def test_morning_boosts_plyushka():
    counts: dict[str, int] = {}
    for uid in range(200):
        pid = pick_persona(
            user_id=uid, today=date(2026, 4, 21),
            tasks_count=3, overdue_count=0, deadline_today_count=0, hour=8,
        )
        counts[pid] = counts.get(pid, 0) + 1
    assert counts.get("plyushka", 0) / 200 > 0.18
