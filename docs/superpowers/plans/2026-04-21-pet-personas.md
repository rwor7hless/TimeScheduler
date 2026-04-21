# Pet Personas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить `/api/reports/daily-tip` в бригаду из 5 котов-персон с двухуровневым ответом (short+long) и стабильным выбором дня; подключить фронт.

**Architecture:** Бекенд хранит 5 персон константами, выбирает одну seeded-random'ом `sha256(user_id:date)` с весами от контекста дня, шлёт в LLM system-шапку + voice + данные, парсит JSON `{short, long}`, обрезает по длине, возвращает `{date, persona, short, long}`. Фронт получает новый шейп, подставляет `persona.eyes_l/eyes_r` в базовое лицо `AsciiPet`, показывает подпись именем под баблом, short в баблe, long в «ещё».

**Tech Stack:** FastAPI + async SQLAlchemy, OpenAI-compatible chat/completions (backend/app/services/gigachat.py), pytest + pytest-asyncio; React 18 + TypeScript + framer-motion + Tailwind.

---

## File Structure

**Backend:**
- Create `backend/prompts/pet_personas.py` — `PERSONAS` dict (id → name/eyes/voice), `pick_persona(...)`, `parse_and_validate(...)`.
- Modify `backend/prompts/pet_tip.py` — переписать `SYSTEM_PROMPT` в `SYSTEM_HEAD` с JSON-форматом, изменить `build_pet_prompt(...)` чтобы принимать `persona_id` и вклеивать voice.
- Modify `backend/app/routers/reports.py:186-268` — `/daily-tip` собирает контекст, вызывает `pick_persona`, строит promt с voice, парсит JSON, отдаёт новый шейп.
- Create `backend/tests/test_pet_personas.py` — unit-тесты на `pick_persona` детерминизм, веса, `parse_and_validate` ветки.

**Frontend:**
- Modify `frontend/src/api/reports.ts:15` — тип ответа `getDailyTip`.
- Modify `frontend/src/hooks/useDailyTip.ts` — новый cache key `pet_tip_v2_*`, хранит весь объект, возвращает `{persona, short, long}`.
- Modify `frontend/src/components/today/AsciiPet.tsx` — prop `persona?`, глаза персоны в базовом mood, подпись `— {name}`, prop `short`+`long` вместо `tip`.
- Modify `frontend/src/pages/TodayPage.tsx` — прокинуть `persona`, `short`, `long` в `<AsciiPet />`.

---

### Task 1: Backend — константы персон

**Files:**
- Create: `backend/prompts/pet_personas.py`

- [ ] **Step 1: Создать файл с пятью персонами**

```python
# backend/prompts/pet_personas.py
"""Пять котов-смен для /api/reports/daily-tip.

Каждая персона — имя, signature-глаза (1-2 unicode-кодпойнта, рендерятся
как один глиф), голос (вклеивается в system-промпт после жёстких правил)
и веса-модификаторы, которые учитываются в pick_persona.
"""
from __future__ import annotations

from typing import TypedDict


class Persona(TypedDict):
    name: str
    eyes_l: str
    eyes_r: str
    voice: str


PERSONAS: dict[str, Persona] = {
    "suhar": {
        "name": "Сухарь",
        "eyes_l": "¬",
        "eyes_r": "¬",
        "voice": (
            "Ты — Сухарь, старый ворчун. Короткие, чуть обрубленные фразы. "
            "Вздыхаешь. Подсвечиваешь просрочки без драмы, с усталостью. "
            "НИКОГДА: восторг, восклицания, похвала. "
            "Пример тона: «Опять эта задача. Прописалась уже». "
            "Пример короткого: «Сегодня пусто. Даже скучно»."
        ),
    },
    "valeryan": {
        "name": "Валерьян",
        "eyes_l": "°",
        "eyes_r": "°",
        "voice": (
            "Ты — Валерьян, философ-абсурдист. Всё вокруг — метафора. "
            "Задачи «пахнут», время «капает», дедлайны «дышат в затылок». "
            "Заканчивай внезапно практичным выводом. "
            "НИКОГДА: сухие формулировки, списки. "
            "Пример: «Утро пахнет чайником и несделанным отчётом»."
        ),
    },
    "blin": {
        "name": "Блин",
        "eyes_l": "-",
        "eyes_r": "-",
        "voice": (
            "Ты — Блин, дзен-минималист. Ровно одно предложение в short, "
            "одно-два в long. Винни-Пух-экономия слов. Спокойно. "
            "НИКОГДА: вводные, перечисления, «также». "
            "Пример: «Одна задача. Закрой её»."
        ),
    },
    "shprot": {
        "name": "Шпрот",
        "eyes_l": "•̀",
        "eyes_r": "•́",
        "voice": (
            "Ты — Шпрот, нуар-детектив. Циничный внутренний монолог. "
            "«Я видел такие списки». Подозреваешь задачу, расследуешь привычку. "
            "НИКОГДА: оптимизм, восклицания. "
            "Пример: «Три встречи и ни одной причины их не отменить. Подозрительно»."
        ),
    },
    "plyushka": {
        "name": "Плюшка",
        "eyes_l": "◡",
        "eyes_r": "◡",
        "voice": (
            "Ты — Плюшка, тёплый остряк. Дружелюбный подкол, без сарказма. "
            "Можешь отметить удачу, но без «молодец!» и «ты справишься!». "
            "НИКОГДА: коучинг, штампы, эмодзи. "
            "Пример: «Медитация в списке — это уже половина медитации»."
        ),
    },
}
```

- [ ] **Step 2: Коммит**

```bash
git add backend/prompts/pet_personas.py
git commit -m "feat(pet): add 5 persona constants"
```

---

### Task 2: Backend — детерминированный выбор персоны

**Files:**
- Modify: `backend/prompts/pet_personas.py`
- Test: `backend/tests/test_pet_personas.py`

- [ ] **Step 1: Написать падающий тест на детерминизм и веса**

```python
# backend/tests/test_pet_personas.py
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
    # При большом количестве просрочек Сухарь должен доминировать
    # в распределении по разным юзерам/датам.
    counts: dict[str, int] = {}
    for uid in range(200):
        pid = pick_persona(
            user_id=uid, today=date(2026, 4, 21),
            tasks_count=3, overdue_count=5, deadline_today_count=0, hour=12,
        )
        counts[pid] = counts.get(pid, 0) + 1
    # При ×3 Сухарь ловит ~3/(3+1+1+1+1) = 43% выборки.
    # Строгая нижняя граница 35% — запас на шум.
    assert counts.get("suhar", 0) / 200 > 0.35


def test_morning_boosts_plyushka():
    counts: dict[str, int] = {}
    for uid in range(200):
        pid = pick_persona(
            user_id=uid, today=date(2026, 4, 21),
            tasks_count=3, overdue_count=0, deadline_today_count=0, hour=8,
        )
        counts[pid] = counts.get(pid, 0) + 1
    # ×1.5 → ~1.5/6.5 ≈ 23%. Нижняя граница с запасом — 18%.
    assert counts.get("plyushka", 0) / 200 > 0.18
```

- [ ] **Step 2: Запустить тесты — должны упасть**

Run: `cd backend && pytest tests/test_pet_personas.py -v`
Expected: FAIL with `ImportError: cannot import name 'pick_persona'`.

- [ ] **Step 3: Реализовать `pick_persona`**

Добавить в конец `backend/prompts/pet_personas.py`:

```python
import hashlib
import random
from datetime import date


def _seed(user_id: int, today: date) -> int:
    """Стабильный 32-битный seed. `hash(...)` нельзя — Python рандомизирует
    его между процессами (PYTHONHASHSEED), что дало бы разного кота при
    каждом рестарте сервера. sha256 детерминирован всегда."""
    digest = hashlib.sha256(f"{user_id}:{today.isoformat()}".encode()).digest()
    return int.from_bytes(digest[:4], "big")


def pick_persona(
    *,
    user_id: int,
    today: date,
    tasks_count: int,
    overdue_count: int,
    deadline_today_count: int,
    hour: int,
) -> str:
    """Возвращает id персоны на день для данного пользователя.

    Стабильно для (user_id, today) — до полуночи один и тот же кот, даже
    после рестарта сервера. Веса корректируются контекстом дня.
    """
    weights: dict[str, float] = {pid: 1.0 for pid in PERSONAS}
    if overdue_count >= 1:
        weights["suhar"] *= 3.0
    if tasks_count >= 5:
        weights["blin"] *= 2.0
    if deadline_today_count >= 2:
        weights["shprot"] *= 1.5
    if 5 <= hour < 12:
        weights["plyushka"] *= 1.5

    rng = random.Random(_seed(user_id, today))
    ids = list(weights.keys())
    return rng.choices(ids, weights=[weights[i] for i in ids], k=1)[0]
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `cd backend && pytest tests/test_pet_personas.py -v`
Expected: 5 passed.

- [ ] **Step 5: Коммит**

```bash
git add backend/prompts/pet_personas.py backend/tests/test_pet_personas.py
git commit -m "feat(pet): weighted seeded persona picker"
```

---

### Task 3: Backend — парсер и валидатор ответа LLM

**Files:**
- Modify: `backend/prompts/pet_personas.py`
- Test: `backend/tests/test_pet_personas.py`

- [ ] **Step 1: Написать падающий тест на парсер**

Добавить в `backend/tests/test_pet_personas.py`:

```python
import pytest

from prompts.pet_personas import parse_and_validate


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
```

- [ ] **Step 2: Запустить — упадут**

Run: `cd backend && pytest tests/test_pet_personas.py -v -k parse`
Expected: 6 FAILs (ImportError).

- [ ] **Step 3: Реализовать `parse_and_validate`**

Добавить в `backend/prompts/pet_personas.py`:

```python
import json
import re

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _truncate(s: str, limit: int) -> str:
    """Обрезает строку до limit, стараясь на границе слова. Добавляет `…`."""
    if len(s) <= limit:
        return s
    cut = s[: limit - 1]
    space = cut.rfind(" ")
    if space > limit * 0.6:  # не отрезаем больше 40% хвоста ради слова
        cut = cut[:space]
    return cut.rstrip(" ,.;:—-") + "…"


def parse_and_validate(raw: str) -> dict[str, str]:
    """Парсит ответ LLM, возвращает `{short, long}`.

    Снимает markdown-```, режет по длине (short ≤ 100, long ≤ 260),
    требует непустой short. На ошибки — RuntimeError (роутер превратит в 503).
    """
    cleaned = _FENCE_RE.sub("", raw.strip()).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"LLM вернул не JSON: {exc}") from exc

    if not isinstance(data, dict) or "short" not in data or "long" not in data:
        raise RuntimeError("LLM не вернул поля short/long")

    short = _truncate(str(data["short"]).strip(), 100)
    long_ = _truncate(str(data["long"]).strip(), 260)

    if not short:
        raise RuntimeError("LLM вернул пустой short")

    return {"short": short, "long": long_}
```

- [ ] **Step 4: Прогнать тесты**

Run: `cd backend && pytest tests/test_pet_personas.py -v`
Expected: все 11 passed.

- [ ] **Step 5: Коммит**

```bash
git add backend/prompts/pet_personas.py backend/tests/test_pet_personas.py
git commit -m "feat(pet): JSON response parser with length trimming"
```

---

### Task 4: Backend — переписать промпт под JSON

**Files:**
- Modify: `backend/prompts/pet_tip.py`

- [ ] **Step 1: Полностью переписать файл**

```python
# backend/prompts/pet_tip.py
"""Сборка промпта для /api/reports/daily-tip.

SYSTEM_HEAD содержит жёсткие правила формата (JSON {short, long}, длины,
запреты). Персона-голос приклеивается ниже и меняет тон, но не формат.
"""
from prompts.pet_personas import PERSONAS


SYSTEM_HEAD = """\
Ты — один из пяти котов-смен в приложении продуктивности.
Какой именно — скажет блок ниже.

━━━ ЖЁСТКИЕ ПРАВИЛА ━━━
1. Формат ответа: строго JSON вида
   {"short": "...", "long": "..."}
   Никакого текста до/после, никакого markdown-обрамления, никаких ```.
2. Длина:
   - short: 1 предложение, не более 100 символов.
   - long:  1–2 предложения, не более 260 символов.
   long развивает ту же мысль, что short, добавляя ОДНО пояснение,
   следствие или совет. Это не цитата short — это его продолжение
   в том же голосе.
3. Обращение: на «ты», от первого лица (я-кот).
4. Язык: живой. Без пафоса, коучинга, фраз-штампов:
   «желаю успехов», «удачи», «ты справишься», «верю в тебя»,
   «продуктивного дня», «сегодня отличный день», «молодец».
5. Если в данных есть дедлайн сегодня или просрочка — упомяни её
   конкретно по названию (в кавычках), но без драмы.
6. Если задач нет — не выдумывай. Скажи это прямо, коротко, в характере.
7. Опирайся ТОЛЬКО на данные в user-сообщении. Никакого markdown, эмодзи.
"""


def build_pet_prompt(
    persona_id: str,
    tasks: list[str],
    habits: list[str],
    deadline_today: list[str],
    overdue: list[str],
) -> list[dict]:
    """Возвращает messages для chat/completions: [system, user].

    persona_id — ключ из PERSONAS; голос персоны вклеивается в system.
    """
    persona = PERSONAS[persona_id]
    system = SYSTEM_HEAD + "\n━━━ ТВОЯ ПЕРСОНА ━━━\n" + persona["voice"]

    data_lines: list[str] = []
    if tasks:
        data_lines.append(
            "Задачи на сегодня (My Day / расписание): "
            + ", ".join(f'«{t}»' for t in tasks)
        )
    else:
        data_lines.append("Задач в My Day или расписании нет.")
    if deadline_today:
        data_lines.append(
            "Дедлайн сегодня: " + ", ".join(f'«{t}»' for t in deadline_today)
        )
    if overdue:
        data_lines.append(
            "Просроченные задачи (давно висят): "
            + ", ".join(f'«{t}»' for t in overdue)
        )
    if habits:
        data_lines.append("Привычки: " + ", ".join(habits))

    user_content = (
        "━━━ ДАННЫЕ ━━━\n"
        + "\n".join(data_lines)
        + "\n\n"
        'Ответь JSON-ом {"short": "...", "long": "..."} в голосе персоны '
        "из system-сообщения. Без markdown, без эмодзи, без штампов."
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]
```

- [ ] **Step 2: Коммит**

```bash
git add backend/prompts/pet_tip.py
git commit -m "feat(pet): rewrite system prompt for JSON persona output"
```

---

### Task 5: Backend — переделать `/daily-tip` эндпоинт

**Files:**
- Modify: `backend/app/routers/reports.py:186-268`

- [ ] **Step 1: Подменить импорты**

Заменить в `backend/app/routers/reports.py` строку `from prompts.pet_tip import build_pet_prompt` на:

```python
from prompts.pet_personas import PERSONAS, parse_and_validate, pick_persona
from prompts.pet_tip import build_pet_prompt
```

- [ ] **Step 2: Переписать тело `get_daily_tip`**

Заменить функцию `get_daily_tip` (строки ~186-268) целиком на:

```python
@router.get("/daily-tip")
async def get_daily_tip(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ежедневное напутствие от одного из пяти котов-персон. Выбор персоны
    детерминирован по (user_id, today). Клиент кешит на сутки.
    """
    today = date.today()
    if not llm_available():
        return {
            "date": str(today),
            "disabled": True,
            "persona": None,
            "short": None,
            "long": None,
        }

    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)

    base = (
        (Task.user_id == current_user.id)
        & (Task.deleted_at.is_(None))
        & (Task.status != KanbanStatus.DONE)
    )

    my_day_rows = (
        await db.execute(
            select(Task.title).where(base, Task.my_day.is_(True)).limit(6)
        )
    ).scalars().all()

    sched_rows = (
        await db.execute(
            select(Task.title).where(
                base,
                Task.my_day.is_(False),
                Task.scheduled_start >= today_start,
                Task.scheduled_start < today_end,
            ).limit(4)
        )
    ).scalars().all()

    deadline_today_rows = (
        await db.execute(
            select(Task.title).where(
                base,
                Task.my_day.is_(False),
                Task.deadline >= today_start,
                Task.deadline < today_end,
                Task.scheduled_start.is_(None),
            ).limit(5)
        )
    ).scalars().all()

    overdue_rows = (
        await db.execute(
            select(Task.title).where(
                base,
                Task.deadline < today_start,
            ).limit(3)
        )
    ).scalars().all()

    habit_names = (
        await db.execute(
            select(Habit.name).where(
                Habit.user_id == current_user.id,
                Habit.is_active.is_(True),
            ).limit(6)
        )
    ).scalars().all()

    all_tasks = list(my_day_rows) + [t for t in sched_rows if t not in my_day_rows]

    # Время в локали пользователя — для утреннего буста Плюшки.
    try:
        from zoneinfo import ZoneInfo
        local_hour = datetime.now(ZoneInfo(settings.user_timezone)).hour
    except Exception:
        local_hour = datetime.utcnow().hour

    persona_id = pick_persona(
        user_id=current_user.id,
        today=today,
        tasks_count=len(all_tasks),
        overdue_count=len(overdue_rows),
        deadline_today_count=len(deadline_today_rows),
        hour=local_hour,
    )

    messages = build_pet_prompt(
        persona_id,
        all_tasks,
        list(habit_names),
        list(deadline_today_rows),
        list(overdue_rows),
    )
    try:
        raw = await chat_completion(messages, max_tokens=260)
        parsed = parse_and_validate(raw)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    persona = PERSONAS[persona_id]
    return {
        "date": str(today),
        "persona": {
            "id": persona_id,
            "name": persona["name"],
            "eyes_l": persona["eyes_l"],
            "eyes_r": persona["eyes_r"],
        },
        "short": parsed["short"],
        "long": parsed["long"],
    }
```

- [ ] **Step 3: Проверить запуск бекенда**

Run: `cd backend && python -c "from app.routers.reports import router; print('ok')"`
Expected: `ok` (импорты разруливаются).

- [ ] **Step 4: Smoke-проверить эндпоинт вручную (опционально, если есть локальная БД)**

Run (в отдельном терминале): `cd backend && uvicorn app.main:app --reload` — затем `curl -H "Authorization: Bearer <token>" http://localhost:8000/api/reports/daily-tip`
Expected (если LLM включён): JSON с полями `date`, `persona`, `short`, `long`.

- [ ] **Step 5: Коммит**

```bash
git add backend/app/routers/reports.py
git commit -m "feat(pet): wire personas into /daily-tip endpoint"
```

---

### Task 6: Frontend — обновить API-клиент

**Files:**
- Modify: `frontend/src/api/reports.ts`

- [ ] **Step 1: Заменить сигнатуру `getDailyTip`**

В `frontend/src/api/reports.ts` заменить строку `getDailyTip: (): Promise<{ tip: string | null; date: string; disabled?: boolean }>` на:

```ts
export interface DailyTipPersona {
  id: string
  name: string
  eyes_l: string
  eyes_r: string
}

export interface DailyTipResponse {
  date: string
  disabled?: boolean
  persona: DailyTipPersona | null
  short: string | null
  long: string | null
}
```

И сам метод:

```ts
  getDailyTip: (): Promise<DailyTipResponse> =>
    client.get('/reports/daily-tip').then((r) => r.data),
```

- [ ] **Step 2: Проверить TS**

Run: `cd frontend && npx tsc --noEmit`
Expected: ошибки только в местах, которые дальше по плану меняем (`useDailyTip`, `TodayPage`, `AsciiPet`).

- [ ] **Step 3: Коммит**

```bash
git add frontend/src/api/reports.ts
git commit -m "feat(pet): frontend API types for persona response"
```

---

### Task 7: Frontend — хук `useDailyTip`

**Files:**
- Modify: `frontend/src/hooks/useDailyTip.ts`

- [ ] **Step 1: Переписать хук**

```ts
// frontend/src/hooks/useDailyTip.ts
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { reportsApi, type DailyTipPersona } from '@/api/reports'

function getUsernameFromToken(): string {
  try {
    const token = localStorage.getItem('token')
    if (!token) return 'anon'
    const payload = JSON.parse(atob(token.split('.')[1]))
    return String(payload.sub ?? 'anon')
  } catch {
    return 'anon'
  }
}

export interface DailyTip {
  persona: DailyTipPersona
  short: string
  long: string
}

export function useDailyTip() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const username = getUsernameFromToken()
  // v2 — старый ключ `daily_tip_*` остаётся висеть, но не читается.
  const cacheKey = `pet_tip_v2_${today}_${username}`

  const [tip, setTip] = useState<DailyTip | null>(() => {
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return null
    try {
      return JSON.parse(raw) as DailyTip
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (tip) return
    setIsLoading(true)
    reportsApi
      .getDailyTip()
      .then((data) => {
        if (data.disabled || !data.persona || !data.short || !data.long) return
        const next: DailyTip = {
          persona: data.persona,
          short: data.short,
          long: data.long,
        }
        setTip(next)
        localStorage.setItem(cacheKey, JSON.stringify(next))
      })
      .catch(() => {
        // LLM недоступен — питомец молчит, фронт покажет fallback.
      })
      .finally(() => setIsLoading(false))
  }, [cacheKey, tip])

  return { tip, isLoading }
}
```

- [ ] **Step 2: Коммит**

```bash
git add frontend/src/hooks/useDailyTip.ts
git commit -m "feat(pet): useDailyTip stores persona + short/long"
```

---

### Task 8: Frontend — `AsciiPet` с персоной и подписью

**Files:**
- Modify: `frontend/src/components/today/AsciiPet.tsx`

- [ ] **Step 1: Прочитать текущий файл целиком**

Run: `cat frontend/src/components/today/AsciiPet.tsx` (или Read tool).

- [ ] **Step 2: Обновить props-интерфейс и сигнатуру компонента**

Найти блок props и заменить `tip?: string | null` (и связанную логику) на:

```ts
import type { DailyTipPersona } from '@/api/reports'

interface AsciiPetProps {
  progress: number
  celebrateKey?: number
  short?: string | null
  long?: string | null
  persona?: DailyTipPersona | null
  layout?: 'vertical' | 'horizontal'
}
```

Заменить пропсы компонента: `function AsciiPet({ progress, celebrateKey, short, long, persona, layout = 'vertical' }: AsciiPetProps)`.

- [ ] **Step 3: Применять signature-глаза только в базовом mood**

В блоке, где вычисляется `face` (использующий `MOODS[mood]`), сразу после получения базового `face` добавить override:

```ts
// Персона перекрывает глаза ТОЛЬКО в базовом content-mood.
// Другие (sleeping, celebrate, petted, proud, …) логически важнее персоны.
const face = (() => {
  const base = MOODS[mood]
  if (mood === 'content' && persona) {
    return { ...base, eyeL: persona.eyes_l, eyeR: persona.eyes_r }
  }
  return base
})()
```

(если в файле уже есть присваивание `const face = MOODS[mood]` — заменить на блок выше; если override уже разруливает blink/wink — вставить эту подмену ДО них.)

- [ ] **Step 4: Показывать `short` в баблe с возможностью развернуть в `long`**

Найти место, где раньше рендерился `tip`, и подставить:

```tsx
{short && (
  <div className="...">
    <p>{expanded ? long ?? short : short}</p>
    {long && long !== short && (
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-accent hover:underline mt-1"
      >
        {expanded ? 'свернуть' : 'ещё'}
      </button>
    )}
    {persona && (
      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        — {persona.name}
      </div>
    )}
  </div>
)}
```

(имя локального стейта `expanded` / `setExpanded` — уже есть в файле для clamp-развёртки; переиспользуй.)

- [ ] **Step 5: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: только ошибки в `TodayPage.tsx` (его меняем в Task 9).

- [ ] **Step 6: Коммит**

```bash
git add frontend/src/components/today/AsciiPet.tsx
git commit -m "feat(pet): render persona signature eyes and name label"
```

---

### Task 9: Frontend — `TodayPage` прокидывает новые пропсы

**Files:**
- Modify: `frontend/src/pages/TodayPage.tsx`

- [ ] **Step 1: Найти использование `useDailyTip`**

Run: `grep -n "useDailyTip\|<AsciiPet" frontend/src/pages/TodayPage.tsx`

- [ ] **Step 2: Заменить деструктуризацию и пропсы**

Было (ориентировочно): `const { tip } = useDailyTip()` и `<AsciiPet tip={tip} ... />`.

Заменить на:

```tsx
const { tip: dailyTip } = useDailyTip()
// ...
<AsciiPet
  progress={petProgress}
  celebrateKey={celebrateKey}
  short={dailyTip?.short ?? null}
  long={dailyTip?.long ?? null}
  persona={dailyTip?.persona ?? null}
  layout="vertical"  // либо "horizontal" в мобильной карточке — в зависимости от места
/>
```

Сделать замену для **каждого** места, где `<AsciiPet>` рендерится (vertical-sidebar и horizontal-mobile-card — оба должны получить одни и те же данные).

- [ ] **Step 3: Проверить TS и билд**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean (модулю `html-to-image` preexisting-ошибка допустима, если уже была).

- [ ] **Step 4: Коммит**

```bash
git add frontend/src/pages/TodayPage.tsx
git commit -m "feat(pet): pass persona and short/long into AsciiPet"
```

---

### Task 10: Ручная проверка

**Files:** (без правок)

- [ ] **Step 1: Поднять backend и frontend**

Run (терминал 1): `cd backend && uvicorn app.main:app --reload`
Run (терминал 2): `cd frontend && npm run dev`

- [ ] **Step 2: Проверить в браузере**

Открыть `/today`. Проверить:
- Бабл показывает 1 короткое предложение.
- Под баблом подпись `— <Имя>`.
- Глаза кота в базовом mood совпадают с `persona.eyes_l/eyes_r`.
- Клик «ещё» раскрывает в длинную версию.
- Переключение dark/light не ломает цвет глаз и подписи.

- [ ] **Step 3: Проверить fallback (LLM выключен)**

В `.env` временно очистить `GIGACHAT_API_KEY`/`NVIDIA_API_KEY`, перезапустить бекенд, удалить `pet_tip_v2_*` из localStorage. Перезагрузить `/today`. Ожидаемо: персоны нет, дефолтные глаза, локальный fallback из пула фраз в `AsciiPet`.

- [ ] **Step 4: Проверить детерминизм**

Перегрузить страницу 2-3 раза в течение дня: персона НЕ меняется (читается из localStorage, плюс бекенд детерминирован).

- [ ] **Step 5: Финальный коммит (если нужны правки)**

Если в ходе ручной проверки вылезли мелкие правки — точечный коммит с префиксом `fix(pet): ...`.

---

## Notes for implementer

- Старое поле `tip` в ответе больше не отдаётся — фронт и бекенд выкатываются одним PR.
- Старый localStorage-кеш (`daily_tip_<date>_<user>`) остаётся висеть у уже залогиненных юзеров. Не чистим — при первом заходе новый ключ подхватит свежий ответ, старый сам истечёт в никуда.
- Weekly-report промпт (`backend/prompts/weekly_report.py`) остаётся как есть, он не зависит от этих изменений.
- Если `chat_completion` иногда возвращает JSON внутри markdown-```, `parse_and_validate` это уже снимает — ручных правок на стороне LLM не нужно.
