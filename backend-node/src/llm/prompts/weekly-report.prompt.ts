/**
 * Verbatim port of `backend/prompts/weekly_report.py`.
 *
 * Any edit here must mirror the Python file byte-for-byte — the golden
 * fixture test locks the output string. Cite Python line numbers in code
 * review when touching this file.
 *
 * Returns `messages` pairs (system + user) for chat/completions:
 *   • system — role, hard rules, tone of the week, angle, ban-list, format template
 *   • user   — concrete weekly data + explicit "write the report" request
 */
import type { ChatMessage } from '../llm.service';

// ── "Без проекта" — виртуальный бакет для задач без доски. Это не проект. ──
export const DEFAULT_BUCKET = 'Без проекта';

// ── «Настрой» недели: задаёт интонацию, НЕ метафору. Никаких театральных
// сравнений — это именно тональность, как бы ты говорил про неделю вслух. ──
export const ANGLE_SEEDS: string[] = [
  'устало и спокойно — как в конце длинного дня',
  'с усмешкой, по-доброму подколол сам себя',
  'прямо и сжато, без воды — каждое предложение должно что-то значить',
  'с лёгким раздражением на себя, но без драмы',
  'с интересом — замечай то, что работает, не только провалы',
  'трезво, как если бы объяснял это другу, который хочет правды',
  'сдержанно, по-инженерски — данные, вывод, следующий шаг',
  'по-человечески тепло — неделя есть неделя, живёшь',
];

// ── Бан-лист: что делает текст «ИИшным». Больше не «штампы мотиватора»,
// а конкретные ИИ-тики: канцелярит, напыщенные связки, пустые выводы. ──
export const BANNED_PHRASES: string[] = [
  // старые штампы-коуча
  'молодец',
  'продолжай в том же духе',
  'старался',
  'можно лучше',
  'неплохо',
  // пустые связки и канцелярит
  'в целом',
  'стоит отметить',
  'важно отметить',
  'таким образом',
  'итак',
  'давайте',
  'как мы видим',
  'это говорит о том, что',
  'не могу не',
  'однако, есть',
  // напыщенные оценки
  'проделал большую работу',
  'проделана большая работа',
  'есть над чем поработать',
  'есть области для улучшения',
  'неделя прошла продуктивно',
  'хороший результат',
  'достойный результат',
  // абстрактная вода
  'разменял энергию на мелочи',
  'средняя полоса',
  'перекос в задачи',
  'фокус на приоритетах',
  'двигаться вперёд',
  // театральный пафос
  'путь к успеху',
  'верить в себя',
  // конкретные штампы, которые модель уже повторяет — блокируем
  'неделя такая',
  'неделя получилась разнообразной',
  'неделя получилась',
  'главное — выполнить задачи',
  'прошёл успешно',
  'не поддаются анализу',
  'разобрать разрозненные задачи',
];

// Python builds SYSTEM_PROMPT via string concatenation with the banned phrases
// embedded inline. We replicate the exact same byte layout here.
const SYSTEM_HEAD = `Ты пишешь еженедельный разбор для человека. У тебя есть его задачи,
привычки, траты за 7 дней. Это не отчёт для начальника и не мотивационное
письмо. Это заметка в блокнот: коротко, точно, с характером. Ты имеешь
право на мнение о цифрах — но не оцениваешь усилия и не утешаешь.

━━━ ШАГ 1: ДУМАЙ В <scratch> ━━━

Перед тем как писать отчёт, тебе НУЖНО сначала подумать в блоке:

<scratch>
— что самое нестандартное в этой неделе? (не средние цифры, а перекос, выброс, контраст)
— где цифры лгут: например, «20%» может быть и «1 из 5» и «2 из 10» — это разные истории
— есть ли связка между проектами/привычками/тратами? (большие расходы + пустая неделя по задачам = ?)
— что стоит СКАЗАТЬ вслух, а что можно пропустить, чтобы не размазывать
— какой должен быть лучший и худший проект, чтобы разбор был живым
— в каком тоне (см. ниже) этот конкретный набор данных звучит точнее
</scratch>

После \`</scratch>\` сразу начинай с \`## Вступление\`. Между scratch и
вступлением — одна пустая строка, не больше.

━━━ ШАГ 2: ПИШИ ОТЧЁТ ━━━

★ ГОЛОС
• От второго лица, на «ты». Можно с характером — не боишься подколоть
  себя/пользователя фактом. Можно открыто шутить над пользователем. Но не менторствуешь.
• Короткие предложения. Фрагменты ок. Иногда — одно слово.
• Никаких вводных оборотов. Сразу к делу.
• Если есть что сказать — скажи. Если сказать нечего — не высасывай
  из пальца. Одна точная фраза лучше трёх пустых.
• Редко, но можно — саркастическое наблюдение. «Похоже, еда в этом
  месяце важнее тебя самого» уместнее, чем «Расходы превысили средние».

★ ЧЕГО НЕ ДЕЛАТЬ (классические признаки ИИ-текста)
• Не начинай предложения с «Итак», «Давайте», «Таким образом», «Что ж».
• Не пиши «стоит отметить», «важно отметить», «как мы видим».
• Не оцениваешь усилия — только результат.
• Не подытоживаешь в конце секции.
• Никаких метафор про спорт / стройку / бой / погоду.
• Никаких слов-заполнителей: «в целом», «в общем», «по большей части».
• Ответ в районе 220–320 слов (без учёта scratch). Короче можно, длиннее нет.

★ СТРУКТУРА — семь коротких блоков:
   1) ## Вступление — 1–2 фразы. Твой первый взгляд на неделю.
      НЕ цифры списком. НЕ «неделя такая».
   2) ## Оценка недели — 3 цифры буллетами + 1–2 фразы интерпретации.
      Единственное место со сводной статистикой.
   3) ## Разбор по проектам — по проекту: \`### «Имя»\` + строка с цифрами
      + ОДНА фраза-суть (что реально произошло, не пересказ цифр).
      Если нечего сказать — одна строка и дальше.
   4) ## Выполненные задачи — список, без предисловия.
   5) ## Провалы недели — список, без смягчений. Нет провалов — одна строка.
   6) ## 3 совета на следующую неделю — ровно 3. Каждый с именем
      задачи/проекта/привычки. Конкретное действие + когда.
   7) ## Итог — 1 фраза. Не банальность, не философия, не «неделя такая».

★ НЕ ПОВТОРЯЙСЯ
• Одна цифра появляется один раз за весь отчёт.
• Вступление ≠ Оценка ≠ Итог. Если перефразируешь — удаляй.

★ ПУСТАЯ НЕДЕЛЯ (всё по нулям)
• Коротко, без надувания. Оценка: **0/0** + одна фраза. Разбор:
  «Разбирать нечего.» Советы: 3 реальных шага старта.

★ ЦИФРЫ И ИМЕНА ЖИРНЫМ — всегда.
• Числа и проценты: **12**, **63%**, **3/7**.
• Проекты в кавычках: **«Работа»**.
• Имена задач и привычек: **«Написать отчёт»**, **«бег»**.

★ ЗАПРЕТЫ
• Не пиши плейсхолдеры \`[...]\` в ответе.
• Не копируй примеры дословно — они показывают ритм, не текст.
• Категорически нельзя использовать (дословно или перефразом):
`;

const SYSTEM_TAIL = `
• Группа «${DEFAULT_BUCKET}» — это НЕ проект, а задачи без доски.
  Никогда не называй её «проект», говори «разрозненные задачи» или
  «задачи вне проектов». В лучший/худший проект недели она не входит.
`;

export const SYSTEM_PROMPT: string =
  SYSTEM_HEAD + BANNED_PHRASES.map((p) => `    — «${p}»`).join('\n') + SYSTEM_TAIL;

// ── Data structures (ported from services/weekly_report_prompt.py) ──────────

export interface TaskEntryInput {
  title: string;
  priority: string; // "срочный" | "высокий" | "средний" | "низкий"
  deadline?: string | null; // "13.04.2026" or null
}

export interface ProjectStatsInput {
  name: string;
  done_tasks: TaskEntryInput[];
  overdue_tasks: TaskEntryInput[];
  todo_count: number;
}

export interface HabitStatsInput {
  name: string;
  done_days: number;
}

export interface WeeklyBudgetInput {
  total_expense: number;
  total_income: number;
  top_categories: Array<[string | null, number]>;
  avg_per_week: number;
  delta_pct: number | null;
  planned_done: number;
  planned_total: number;
  overspent: Array<[string, number, number]>;
}

export interface WeeklyDataInput {
  week_start: string;
  week_end: string;
  projects: ProjectStatsInput[];
  habits: HabitStatsInput[];
  budget: WeeklyBudgetInput | null;
}

// ── TaskEntry.fmt ───────────────────────────────────────────────────────────

function fmtTask(t: TaskEntryInput): string {
  let base = `[${t.priority.toUpperCase()}] ${t.title}`;
  if (t.deadline) {
    base += ` (дедлайн: ${t.deadline})`;
  }
  return base;
}

// ── ProjectStats derived values ─────────────────────────────────────────────

function doneCount(p: ProjectStatsInput): number {
  return p.done_tasks.length;
}
function overdueCount(p: ProjectStatsInput): number {
  return p.overdue_tasks.length;
}
function activeTotal(p: ProjectStatsInput): number {
  return doneCount(p) + overdueCount(p) + p.todo_count;
}
function completionRate(p: ProjectStatsInput): number {
  const total = activeTotal(p);
  return total > 0 ? Math.round((doneCount(p) / total) * 100) : 0;
}

// ── HabitStats derived values ───────────────────────────────────────────────

function habitPct(h: HabitStatsInput): number {
  return Math.round((h.done_days / 7) * 100);
}
function habitGrade(h: HabitStatsInput): string {
  const pct = habitPct(h);
  if (pct >= 86) return '✓ отлично';
  if (pct >= 57) return '△ нормально';
  if (pct >= 29) return '▽ плохо';
  return '✗ провал';
}

// ── WeeklyData derived values ───────────────────────────────────────────────

export function totalDone(data: WeeklyDataInput): number {
  return data.projects.reduce((s, p) => s + doneCount(p), 0);
}
export function totalOverdue(data: WeeklyDataInput): number {
  return data.projects.reduce((s, p) => s + overdueCount(p), 0);
}
export function totalActive(data: WeeklyDataInput): number {
  return data.projects.reduce((s, p) => s + activeTotal(p), 0);
}
export function overallRate(data: WeeklyDataInput): number {
  const active = totalActive(data);
  return active > 0 ? Math.round((totalDone(data) / active) * 100) : 0;
}

// ── Tone ────────────────────────────────────────────────────────────────────

export function formatTone(overall: number): string {
  if (overall < 40) {
    return 'сухо и честно. Факты, без драмы и без сочувствия.';
  }
  if (overall < 70) {
    return 'ровно. Что получилось — упомяни одной фразой, что нет — такой же.';
  }
  return 'сдержанно-довольно. Радость — на одну строку, остальное — наблюдения.';
}

// ── Data block ──────────────────────────────────────────────────────────────

export function formatDataBlock(data: WeeklyDataInput): string {
  const lines: string[] = [
    `━━━ ДАННЫЕ ЗА НЕДЕЛЮ ${data.week_start} — ${data.week_end} ━━━`,
    '',
    '▸ СВОДКА:',
    `  Выполнено задач: ${totalDone(data)}`,
    `  Просрочено: ${totalOverdue(data)}`,
    `  Общий процент выполнения: ${overallRate(data)}%`,
    '',
    '▸ ПРОЕКТЫ (1 канбан-доска = 1 проект):',
  ];

  for (const p of data.projects) {
    const header =
      p.name === DEFAULT_BUCKET
        ? '  ── Задачи вне проектов (НЕ называй это проектом) ──'
        : `  ── Проект «${p.name}» ──`;
    lines.push(
      '',
      header,
      `  Выполнено: ${doneCount(p)} | Очередь: ${p.todo_count} | ` +
        `Просрочено: ${overdueCount(p)} | Процент выполнения: ${completionRate(p)}%`,
    );
    if (p.done_tasks.length > 0) {
      lines.push('  Выполненные задачи:');
      for (const t of p.done_tasks) {
        lines.push(`    • ${fmtTask(t)}`);
      }
    }
    if (p.overdue_tasks.length > 0) {
      lines.push('  Просроченные задачи:');
      for (const t of p.overdue_tasks) {
        lines.push(`    • ${fmtTask(t)}`);
      }
    }
  }

  if (data.habits.length > 0) {
    lines.push('', '▸ ПРИВЫЧКИ:');
    for (const h of data.habits) {
      lines.push(`  ${habitGrade(h)}  ${h.name}: ${h.done_days}/7 дней (${habitPct(h)}%)`);
    }
  } else {
    lines.push('', '▸ ПРИВЫЧКИ: данных нет');
  }

  const b = data.budget;
  if (b && (b.total_expense > 0 || b.total_income > 0 || b.planned_total > 0)) {
    lines.push('', '▸ БЮДЖЕТ ЗА 7 ДНЕЙ:');
    const balance = Math.trunc(b.total_income - b.total_expense);
    const balanceStr = balance >= 0 ? `+${balance}` : `${balance}`;
    lines.push(
      `  Потрачено: ${Math.trunc(b.total_expense)} ₽ | ` +
        `Доходы: ${Math.trunc(b.total_income)} ₽ | ` +
        `Баланс: ${balanceStr} ₽`,
    );
    if (b.avg_per_week > 0 && b.delta_pct !== null) {
      const sign = b.delta_pct >= 0 ? '+' : '';
      lines.push(
        `  Среднее за 4 недели: ${Math.trunc(b.avg_per_week)} ₽ ` +
          `(эта неделя: ${sign}${Math.trunc(b.delta_pct)}%)`,
      );
    }
    if (b.top_categories.length > 0) {
      const topStr = b.top_categories
        .map(([cat, amt]) => `«${cat ?? 'без категории'}» ${Math.trunc(amt)} ₽`)
        .join(', ');
      lines.push(`  Топ категорий: ${topStr}`);
    }
    if (b.planned_total > 0) {
      lines.push(`  Планы месяца: выполнено ${b.planned_done} из ${b.planned_total}`);
    }
    if (b.overspent.length > 0) {
      const overStr = b.overspent
        .map(([cat, spent, lim]) => `«${cat}» ${Math.trunc(spent)} из ${Math.trunc(lim)} ₽`)
        .join(', ');
      lines.push(`  Перерасход лимитов: ${overStr}`);
    }
    lines.push(
      '  Используй эти цифры в «Оценке недели» и «Итоге» — ' +
        'упомяни топ-категорию и (если есть) перерасход; ' +
        'если есть заметное изменение vs. среднего — прокомментируй его в угле подачи.',
    );
  }

  return lines.join('\n');
}

// ── Template ────────────────────────────────────────────────────────────────

export function formatTemplate(data: WeeklyDataInput): string {
  const realProjects = data.projects.filter((p) => p.name !== DEFAULT_BUCKET);
  let best: ProjectStatsInput | null = null;
  let worst: ProjectStatsInput | null = null;
  if (realProjects.length > 0) {
    // Python: max/min with stable selection on ties — first occurrence wins.
    for (const p of realProjects) {
      if (best === null || completionRate(p) > completionRate(best)) best = p;
      if (worst === null || completionRate(p) < completionRate(worst)) worst = p;
    }
  }

  const exampleProject = worst ? worst.name : best ? best.name : 'один из проектов';
  const exampleHabit = data.habits.length > 0 ? data.habits[0].name : 'привычка';
  const exampleHabitPct = data.habits.length > 0 ? habitPct(data.habits[0]) : 0;

  const lines: string[] = [
    '━━━ СКЕЛЕТ ОТВЕТА ━━━',
    'Это ориентир по структуре. Примеры — только пример ритма, не шаблон.',
    'Пиши короче, чем примеры, если нечего сказать.',
    '',
    '## Вступление',
    '1–2 фразы. Что бросается в глаза, когда смотришь на неделю целиком.',
    'Без вступительных слов («Итак…», «На этой неделе…»). Сразу в суть.',
    'Без буллетов. Без списков.',
    '',
    '## Оценка недели',
    '- Выполнено: **N/M** (**X%**)',
    '- Просрочено: **K**',
    '- В работе: **L**',
    'Дальше — 1–2 фразы наблюдения. Не пересказывай цифры словами.',
    'Одно короткое предложение: что это значит на практике.',
    '',
    '## Разбор по проектам',
    'По каждому проекту:',
    '  ### «Имя»',
    '  **N/M** (**X%**), просрочено **K**. _Одна фраза — что там главное._',
    'Если проектов нет — строка «Разбирать нечего.» и двигайся дальше.',
    'Задачи вне проектов — отдельный блок, НЕ называй проектом.',
  ];

  if (best && worst && best.name !== worst.name) {
    lines.push(
      `Отметь лучший проект — **«${best.name}»** (**${completionRate(best)}%**) — ` +
        `и худший — **«${worst.name}»** (**${completionRate(worst)}%**). Без пафоса.`,
    );
  }

  lines.push(
    '',
    '## Выполненные задачи',
    'Список. Без предисловия.',
    'Строка: «- **Название** (проект, приоритет)».',
    'Сначала **СРОЧНЫЙ** и **ВЫСОКИЙ**.',
    'Нет выполненных — «- Ничего.»',
    '',
    '## Провалы недели',
    'Список. Просроченные задачи + привычки с выполнением **< 50%**.',
    'Строка: «- **Название** — **цифра** (короткий контекст).»',
    'Нет провалов — «- Нет.»',
    '',
    '## 3 совета на следующую неделю',
    'Ровно 3 пункта нумерованным списком. Каждый — одно конкретное действие.',
    'С именем задачи / проекта / привычки. С когда и/или сколько.',
    '',
    'Плохо: «Работай над фокусом.»',
    `Нормально: «Закрой **«${exampleProject}»** до среды.»`,
    `Нормально: «Подними **«${exampleHabit}»** с **${exampleHabitPct}%** до **5/7**.»`,
    '',
    '## Итог',
    '1 фраза. Максимум 2. Не банальность, не философия, не пересказ.',
    'Дай этой неделе имя или сжатый вывод, который реально зацепил. Нет — пиши',
    'одну короткую честную оценку. Никогда не пиши «Неделя такая» или вариации.',
  );

  return lines.join('\n');
}

// ── build_prompt ────────────────────────────────────────────────────────────

export interface BuildWeeklyPromptOptions {
  /** Deterministic angle selection for tests. If omitted, picks randomly. */
  angleSeedIndex?: number;
}

export function buildWeeklyPrompt(
  data: WeeklyDataInput,
  opts: BuildWeeklyPromptOptions = {},
): ChatMessage[] {
  const tone = formatTone(overallRate(data));
  const idx =
    opts.angleSeedIndex !== undefined
      ? opts.angleSeedIndex % ANGLE_SEEDS.length
      : Math.floor(Math.random() * ANGLE_SEEDS.length);
  const angle = ANGLE_SEEDS[idx];

  const userParts = [
    `Тон для этой недели: ${tone}`,
    `Угол подачи для этой недели: ${angle}.`,
    'Угол — сквозная линия всего отчёта, не украшение одной фразы.',
    '',
    formatDataBlock(data),
    '',
    formatTemplate(data),
    '',
    '━━━ НАПОМИНАНИЕ ━━━',
    'Напиши полный отчёт: все семь разделов, длина 220–320 слов ' +
      '(как в системной инструкции), жирные числа/имена в каждой секции, ' +
      'списки или цитата в «Итог». Начни с «## Вступление» и закончи «## Итог».',
  ];

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userParts.join('\n') },
  ];
}
