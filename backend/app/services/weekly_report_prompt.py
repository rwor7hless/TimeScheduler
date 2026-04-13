"""
Шаблон промпта для еженедельного AI-отчёта.

Редактируй этот файл, чтобы изменить структуру, тон и формат отчёта —
без правок логики сбора данных.
"""
from dataclasses import dataclass, field


# ──────────────────────────────────────────────────────────────────────────────
# Структуры данных
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class TaskEntry:
    title: str
    priority: str  # "срочный" | "высокий" | "средний" | "низкий"
    deadline: str | None = None  # "13.04.2026" или None

    def fmt(self) -> str:
        base = f"[{self.priority.upper()}] {self.title}"
        if self.deadline:
            base += f" (дедлайн: {self.deadline})"
        return base


@dataclass
class ProjectStats:
    name: str
    done_tasks: list[TaskEntry] = field(default_factory=list)
    overdue_tasks: list[TaskEntry] = field(default_factory=list)
    in_progress_tasks: list[TaskEntry] = field(default_factory=list)
    todo_count: int = 0  # задачи в очереди (без показа списка, чтобы не раздувать промпт)

    @property
    def done_count(self) -> int:
        return len(self.done_tasks)

    @property
    def overdue_count(self) -> int:
        return len(self.overdue_tasks)

    @property
    def in_progress_count(self) -> int:
        return len(self.in_progress_tasks)

    @property
    def active_total(self) -> int:
        """Выполнено + провалено + в работе (для % выполнения)."""
        return self.done_count + self.overdue_count + self.in_progress_count + self.todo_count

    @property
    def completion_rate(self) -> int:
        return round(self.done_count / self.active_total * 100) if self.active_total > 0 else 0


@dataclass
class HabitStats:
    name: str
    done_days: int  # из 7

    @property
    def pct(self) -> int:
        return round(self.done_days / 7 * 100)

    @property
    def grade(self) -> str:
        if self.pct >= 86:   # 6/7+
            return "✓ отлично"
        elif self.pct >= 57:  # 4/7+
            return "△ нормально"
        elif self.pct >= 29:  # 2/7+
            return "▽ плохо"
        else:
            return "✗ провал"


@dataclass
class WeeklyData:
    week_start: str   # "07.04.2026"
    week_end: str     # "13.04.2026"
    projects: list[ProjectStats] = field(default_factory=list)
    habits: list[HabitStats] = field(default_factory=list)

    @property
    def total_done(self) -> int:
        return sum(p.done_count for p in self.projects)

    @property
    def total_overdue(self) -> int:
        return sum(p.overdue_count for p in self.projects)

    @property
    def total_in_progress(self) -> int:
        return sum(p.in_progress_count for p in self.projects)

    @property
    def total_active(self) -> int:
        return sum(p.active_total for p in self.projects)

    @property
    def overall_rate(self) -> int:
        return round(self.total_done / self.total_active * 100) if self.total_active > 0 else 0


# ──────────────────────────────────────────────────────────────────────────────
# Построитель промпта
# ──────────────────────────────────────────────────────────────────────────────

def build_prompt(data: WeeklyData) -> str:
    """
    Строит промпт для GigaChat из структурированных данных недели.
    Меняй текст здесь — логика сбора данных в weekly_report.py.
    """

    # ── Оценка для few-shot примера в формате ──
    if data.overall_rate >= 70:
        rate_label = "хороший результат"
    elif data.overall_rate >= 40:
        rate_label = "средний результат"
    else:
        rate_label = "низкий результат"

    # ── Лучший и худший проект ──
    if data.projects:
        best = max(data.projects, key=lambda p: p.completion_rate)
        worst = min(data.projects, key=lambda p: p.completion_rate)
    else:
        best = worst = None

    lines: list[str] = []

    # ── РОЛЬ ──
    lines += [
        "Ты — близкий друг и наставник пользователя, который искренне заинтересован в его росте.",
        "Ты знаешь его задачи и привычки за эту неделю — они перечислены ниже.",
        "Твоя задача: написать еженедельный разбор так, как будто вы сидите за кофе и ты честно,",
        "но по-человечески говоришь ему, как прошла неделя. Не как робот, не как корпоративный отчёт.",
        "",
    ]

    # ── ЖЁСТКИЕ ПРАВИЛА ──
    lines += [
        "━━━ ПРАВИЛА (нарушение любого = неприемлемый ответ) ━━━",
        "1. Первый абзац («Вступление») — живая оценка недели от лица друга/наставника.",
        "   Пиши от первого лица, обращайся на «ты».",
        "   Обязательно включи конкретные цифры и назови хотя бы один проект или привычку.",
        f"   Тон: {'говори прямо и жёстко, но без занудства — как друг, которому надоело смотреть на повторяющиеся ошибки.' if data.overall_rate < 40 else 'смешай честную критику с признанием того, что получилось — не хвали огульно, но и не дави.' if data.overall_rate < 70 else 'искренняя радость за результат, но сразу укажи на слабое место — чтобы не расслаблялся.'}",
        "   ЗАПРЕЩЕНО использовать фразы: «не тот результат, которого я от тебя жду»,",
        "   «не те результаты», «ожидал большего», «можно лучше», «старался»,",
        "   «продолжай в том же духе», «молодец», «неплохо», «в целом».",
        "   Каждый раз формулируй вступление по-новому — не используй шаблонные обороты.",
        "2. Каждое утверждение должно содержать цифру или название задачи/привычки из данных.",
        "3. Если данных нет — пиши «данных нет», не выдумывай.",
        "4. Советы должны ссылаться на конкретные задачи, проекты или привычки из данных.",
        "5. Используй Markdown (##, **, –, числовые списки).",
        "6. Не повторяй сырые данные — интерпретируй их.",
        "",
    ]

    # ── ДАННЫЕ ──
    lines += [
        f"━━━ ДАННЫЕ ЗА НЕДЕЛЮ {data.week_start} — {data.week_end} ━━━",
        "",
        "▸ СВОДКА:",
        f"  Выполнено задач: {data.total_done}",
        f"  Просрочено: {data.total_overdue}",
        f"  В работе (незакрытые): {data.total_in_progress}",
        f"  Общий процент выполнения: {data.overall_rate}%",
        "",
    ]

    # ── ПРОЕКТЫ ──
    lines.append("▸ ПРОЕКТЫ (1 канбан-доска = 1 проект):")
    for p in data.projects:
        lines += [
            "",
            f"  ── Проект «{p.name}» ──",
            f"  Выполнено: {p.done_count} | В работе: {p.in_progress_count} | "
            f"Очередь: {p.todo_count} | Просрочено: {p.overdue_count} | "
            f"Процент выполнения: {p.completion_rate}%",
        ]
        if p.done_tasks:
            lines.append("  Выполненные задачи:")
            for t in p.done_tasks:
                lines.append(f"    • {t.fmt()}")
        if p.overdue_tasks:
            lines.append("  Просроченные задачи:")
            for t in p.overdue_tasks:
                lines.append(f"    • {t.fmt()}")
        if p.in_progress_tasks:
            lines.append("  В процессе (незакрытые):")
            for t in p.in_progress_tasks:
                lines.append(f"    • {t.fmt()}")

    # ── ПРИВЫЧКИ ──
    if data.habits:
        lines += ["", "▸ ПРИВЫЧКИ:"]
        for h in data.habits:
            lines.append(f"  {h.grade}  {h.name}: {h.done_days}/7 дней ({h.pct}%)")
    else:
        lines += ["", "▸ ПРИВЫЧКИ: данных нет"]

    # ── ФОРМАТ ОТВЕТА ──
    lines += [
        "",
        "━━━ ФОРМАТ ОТВЕТА ━━━",
        "",
        "## [БЕЗ ЗАГОЛОВКА — сразу текст, не пиши слово «Вступление»]",
        "3–5 предложений живым языком от лица друга-наставника. Обращайся на «ты».",
        "Передай общее ощущение от недели — как будто ты видел, как человек работал.",
        "Обязательно вплети цифры и конкретные проекты/привычки из данных.",
        "Каждый раз пиши по-разному — не копируй примеры дословно, они только для вдохновения.",
        "",
        "Примеры разных стилей вступления (выбери подходящий или придумай свой):",
        f"• Прямой: «{data.total_done} задач за неделю — и {data.total_overdue} просроченных. Давай честно: [твоя оценка конкретной ситуации].»",
        f"• С иронией: «Ну что, {data.week_start} позади. [Остроумное наблюдение про конкретный проект или привычку с цифрой].»",
        f"• Аналитический: «Смотри что получается: [конкретный разбор перекоса между проектами или привычками].»",
        f"• Поддерживающий (только если rate >= 70): «{data.total_done} задач закрыто — это уже история. [Что именно удалось и где ещё есть дыра].»",
        "",
        "## Оценка недели",
        "2–3 предложения. Обязательно: итоговый % выполнения, число просрочек, общая картина.",
        f"Пример: «Выполнено {data.total_done} задач из {data.total_active} ({data.overall_rate}%) — {rate_label}.",
        f"Просрочено {data.total_overdue} задач{'и' if data.total_overdue in (2, 3, 4) else ''}.",
        f"{'В работе осталось ' + str(data.total_in_progress) + ' незакрытых задач.' if data.total_in_progress else ''}»",
        "",
        "## Разбор по проектам",
        "По каждому проекту — 1–2 предложения с цифрами из данных.",
    ]
    if best and worst and best.name != worst.name:
        lines += [
            f"Обязательно укажи лучший проект недели («{best.name}», {best.completion_rate}%) и",
            f"худший («{worst.name}», {worst.completion_rate}%).",
        ]

    lines += [
        "",
        "## Выполненные задачи",
        "Перечисли выполненные задачи, начиная с приоритета СРОЧНЫЙ/ВЫСОКИЙ.",
        "Если задач нет — напиши «Выполненных задач нет».",
        "",
        "## Провалы недели",
        "Перечисли просроченные задачи и привычки с выполнением < 50%. Без смягчений.",
        "Если провалов нет — напиши «Провалов нет».",
        "",
        "## 3 совета на следующую неделю",
        "Каждый совет — одно конкретное действие, ссылающееся на задачу/проект/привычку из данных.",
        "Плохой совет: «Старайся больше успевать.»",
        "Хороший совет: «Закрой просроченные задачи из проекта «[X]» в первую очередь в понедельник.»",
        "",
        "## Итог",
        "Одна фраза. Главная цифра недели + честная оценка без воды.",
    ]

    return "\n".join(lines)
