"""
Структуры данных для еженедельного AI-отчёта.

Промпт (тон, структура, правила) — в prompts/weekly_report.py.
Логика сбора данных — в services/weekly_report.py.
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
class WeeklyBudget:
    total_expense: float
    total_income: float
    top_categories: list[tuple[str | None, float]] = field(default_factory=list)  # [(category_id, amount), ...]
    avg_per_week: float = 0.0
    delta_pct: float | None = None  # vs. avg per week; None когда базы нет
    planned_done: int = 0
    planned_total: int = 0
    overspent: list[tuple[str, float, float]] = field(default_factory=list)  # [(category, spent, limit), ...]


@dataclass
class WeeklyData:
    week_start: str   # "07.04.2026"
    week_end: str     # "13.04.2026"
    projects: list[ProjectStats] = field(default_factory=list)
    habits: list[HabitStats] = field(default_factory=list)
    budget: WeeklyBudget | None = None

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


