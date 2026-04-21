from datetime import date

import pytest

from prompts.pet_personas import PERSONAS, pick_persona, parse_and_validate


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


def test_parse_clean_json():
    raw = '{"short": "Короткая.", "long": "Короткая. Развитие."}'
    out = parse_and_validate(raw)
    assert out == {"short": "Короткая.", "long": "Короткая. Развитие."}


def test_parse_markdown_fenced_json():
    raw = '```json\n{"short": "A.", "long": "A. B."}\n```'
    out = parse_and_validate(raw)
    assert out["short"] == "A."


def test_parse_truncates_long_fields():
    long_short = "x" * 150
    long_long = "y" * 400
    raw = f'{{"short": "{long_short}", "long": "{long_long}"}}'
    out = parse_and_validate(raw)
    assert len(out["short"]) <= 100
    assert len(out["long"]) <= 260
    assert out["short"].endswith("…")
    assert out["long"].endswith("…")


def test_parse_rejects_missing_keys():
    with pytest.raises(RuntimeError):
        parse_and_validate('{"short": "only"}')


def test_parse_rejects_empty_short():
    with pytest.raises(RuntimeError):
        parse_and_validate('{"short": "", "long": "x"}')


def test_parse_rejects_non_json():
    with pytest.raises(RuntimeError):
        parse_and_validate("это просто текст от модели")
