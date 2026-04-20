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

// ── Рандомный «угол подачи»: сквозная риторическая линза для всего отчёта. ──
// Берём один на неделю, чтобы разбор каждую неделю звучал по-новому и не
// скатывался в «среднюю полосу / разменял энергию на мелочи».
export const ANGLE_SEEDS: string[] = [
  'через метафору спорта/тренировки (объём, интенсивность, восстановление)',
  'через метафору финансов (вложил/потратил время, дивиденды, убытки)',
  'через метафору стройки/ремонта (фундамент, черновая, отделка)',
  'через метафору погоды/сезона (штиль, шторм, оттепель)',
  'через метафору боя/кампании (фронт, фланг, потери, победы)',
  'через метафору кухни/рецепта (ингредиенты, пересол, недоварил)',
  'через метафору музыки (ритм, пауза, диссонанс, сыгранность)',
  'сухо и бухгалтерски — цифра за цифрой, без метафор вообще',
  'через диалог с самим собой прошлой недели (что сказал бы себе в понедельник)',
  'через сравнение с идеальной версией недели (где был зазор)',
];

// ── Бан-лист: штампы, которые модель любит повторять из недели в неделю. ──
export const BANNED_PHRASES: string[] = [
  'не тот результат, которого я от тебя жду',
  'не те результаты',
  'ожидал большего',
  'можно лучше',
  'старался',
  'продолжай в том же духе',
  'молодец',
  'неплохо',
  'в целом',
  'средняя полоса',
  'хороший результат',
  'разменял энергию на мелочи',
  'разменял энергию',
  'перекос в задачи',
  'есть области для улучшения',
  'неделя прошла продуктивно',
  'однако, есть',
  'это говорит о том, что',
];

// Python builds SYSTEM_PROMPT via string concatenation with the banned phrases
// embedded inline. We replicate the exact same byte layout here.
const SYSTEM_HEAD = `Ты — близкий друг и наставник пользователя, который искренне заинтересован
в его росте. Ты знаешь его задачи и привычки за прошедшую неделю — они
будут перечислены в user-сообщении.

Задача: написать еженедельный разбор так, как будто вы сидите за кофе и ты
честно, но по-человечески говоришь, как прошла неделя. Не робот, не
корпоративный отчёт.

━━━ ЖЁСТКИЕ ПРАВИЛА (нарушение любого = неприемлемый ответ) ━━━

★ СТРУКТУРА — ровно семь разделов, в этом порядке:
   1) ## Вступление
   2) ## Оценка недели
   3) ## Разбор по проектам
   4) ## Выполненные задачи
   5) ## Провалы недели
   6) ## 3 совета на следующую неделю
   7) ## Итог
Пропуск любого раздела = неприемлемый ответ. Не останавливайся после
вступления — иди до «Итога».
Минимальный объём — 400 слов.

★ ЯЗЫК И ТОН
• Пиши от первого лица, обращайся на «ты».
• Тон и угол подачи недели придут в user-сообщении — держи их сквозной
  линией по всему отчёту, а не украшением одной фразы.
• Не повторяй формулировки прошлых отчётов: каждую неделю — новая подача.

★ ФАКТЫ И ДАННЫЕ
• Каждое утверждение должно содержать цифру или название задачи/привычки
  из данных. Если данных нет — пиши «данных нет», не выдумывай.
• Советы должны ссылаться на конкретные задачи, проекты или привычки.
• Не повторяй сырые данные дословно — интерпретируй.

★ MARKDOWN — обязателен в каждой секции, голых абзацев недостаточно.
Жирный \`**...**\` обязателен для трёх категорий:
  (a) все числа и проценты: **12**, **63%**, **3/7**, **0 из 5**;
  (b) названия проектов в кавычках: **«Проект X»**;
  (c) ключевые названия задач и привычек: **«Написать отчёт»**, **«бег»**.
Плоский текст без жирных акцентов = неприемлемый ответ.

★ СПИСКИ В КАЖДОЙ СЕКЦИИ (кроме «Итог», там можно цитату \`>\`)
• «Вступление»: 2–3 короткие фразы + буллеты с наблюдениями.
• «Оценка недели»: буллет-список ключевых метрик → 2–3 предложения
  интерпретации в выбранном угле подачи.
• «Разбор по проектам»: по каждому проекту \`### «Имя»\` + буллеты + 1–2
  предложения вывода.
• «Выполненные» и «Провалы»: только списки, без вступительных абзацев.
• «3 совета»: ровно три пункта \`1.\` \`2.\` \`3.\`, каждый — одно действие.
• «Итог»: 1–2 фразы + цитата \`>\` с главным выводом недели.

★ ЗАПРЕТЫ
• Запрещены текстовые маркеры-плейсхолдеры в квадратных скобках \`[...]\`.
  Образцы стиля в user-сообщении — это стиль, а не шаблон для заполнения.
• Не копируй образцы дословно — бери ритм и переписывай своими словами
  на реальных данных.
• Запрещённые штампы (ни дословно, ни по смыслу):
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
  in_progress_tasks: TaskEntryInput[];
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
function inProgressCount(p: ProjectStatsInput): number {
  return p.in_progress_tasks.length;
}
function activeTotal(p: ProjectStatsInput): number {
  return doneCount(p) + overdueCount(p) + inProgressCount(p) + p.todo_count;
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
export function totalInProgress(data: WeeklyDataInput): number {
  return data.projects.reduce((s, p) => s + inProgressCount(p), 0);
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
    return (
      'говори прямо и жёстко, но без занудства — ' +
      'как друг, которому надоело смотреть на повторяющиеся ошибки.'
    );
  }
  if (overall < 70) {
    return (
      'смешай честную критику с признанием того, что получилось — ' +
      'не хвали огульно, но и не дави.'
    );
  }
  return (
    'искренняя радость за результат, но сразу укажи на слабое место — ' + 'чтобы не расслаблялся.'
  );
}

// ── Data block ──────────────────────────────────────────────────────────────

export function formatDataBlock(data: WeeklyDataInput): string {
  const lines: string[] = [
    `━━━ ДАННЫЕ ЗА НЕДЕЛЮ ${data.week_start} — ${data.week_end} ━━━`,
    '',
    '▸ СВОДКА:',
    `  Выполнено задач: ${totalDone(data)}`,
    `  Просрочено: ${totalOverdue(data)}`,
    `  В работе (незакрытые): ${totalInProgress(data)}`,
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
      `  Выполнено: ${doneCount(p)} | В работе: ${inProgressCount(p)} | ` +
        `Очередь: ${p.todo_count} | Просрочено: ${overdueCount(p)} | ` +
        `Процент выполнения: ${completionRate(p)}%`,
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
    if (p.in_progress_tasks.length > 0) {
      lines.push('  В процессе (незакрытые):');
      for (const t of p.in_progress_tasks) {
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
    '━━━ ФОРМАТ ОТВЕТА ━━━',
    'Ниже — скелет с живыми примерами на твоих реальных данных.',
    'Это ОБРАЗЦЫ СТИЛЯ, а не шаблоны: перепиши своими словами.',
    '',
    '## Вступление',
    '2–3 коротких предложения живым языком, на «ты».',
    'Потом буллет-список с **жирными** цифрами — 2–3 наблюдения одной строкой.',
    '',
    'Образец стиля (перепиши):',
    `  «Неделя закрыта. **${totalDone(data)}** задач в зачёт, но ` +
      `**${totalOverdue(data)}** просрочил.»`,
    `  – **${overallRate(data)}%** выполнения — общий фон недели.`,
    `  – «**${exampleProject}**» задал темп (или тянул вниз — по данным).`,
    `  – Привычка «**${exampleHabit}**» закрыта на **${exampleHabitPct}%**.`,
    '',
    '## Оценка недели',
    'Буллет-список ключевых метрик (каждая цифра — жирной):',
    `  – Выполнено: **${totalDone(data)}** из **${totalActive(data)}** ` +
      `(**${overallRate(data)}%**)`,
    `  – Просрочено: **${totalOverdue(data)}**`,
    `  – В работе: **${totalInProgress(data)}**`,
    'Потом 2–3 предложения интерпретации В ВЫБРАННОМ УГЛЕ ПОДАЧИ.',
    'Интерпретация должна быть конкретной: что это значит на уровне недели,',
    'где слабое звено, где сильное. Без штампов из бан-листа.',
    '',
    '## Разбор по проектам',
    'По КАЖДОМУ проекту из данных — блок вида:',
    '  ### «Имя проекта»',
    '  – Выполнено: **N/M** (**X%**)',
    '  – Просрочено: **K**',
    '  – Ключ: `одно-два предложения — что главное в проекте на неделе`.',
    'Группу «задачи вне проектов» тоже разбери отдельным блоком, но ' + 'НЕ называй проектом.',
  ];

  if (best && worst && best.name !== worst.name) {
    lines.push(
      `Обязательно укажи лучший — **«${best.name}»** ` +
        `(**${completionRate(best)}%**) — и худший — **«${worst.name}»** ` +
        `(**${completionRate(worst)}%**).`,
    );
  }

  lines.push(
    '',
    '## Выполненные задачи',
    'Только маркированный список, без вступительных фраз.',
    'Формат строки: «– **Название задачи** (проект, приоритет)».',
    'Сортируй по приоритету: сначала **СРОЧНЫЙ** и **ВЫСОКИЙ**.',
    'Если задач нет — строка «– Выполненных задач нет».',
    '',
    '## Провалы недели',
    'Только маркированный список: просроченные задачи + привычки с ' + 'выполнением **< 50%**.',
    'Формат: «– **Название** — **цифра** (контекст в одно слово)».',
    'Без смягчений. Если провалов нет — «– Провалов нет».',
    '',
    '## 3 совета на следующую неделю',
    'Ровно три совета нумерованным списком `1.` `2.` `3.`.',
    'Каждый совет — одно КОНКРЕТНОЕ действие со ссылкой на ' +
      'задачу/проект/привычку. Имена и числа — **жирным**.',
    'Плохой совет: «Старайся больше успевать.» — запрещено.',
    `Хороший: «Закрой просроченные задачи из **«${exampleProject}»** ` +
      `в **понедельник** утром.»`,
    `Ещё: «Подними **«${exampleHabit}»** до **5/7** — сейчас ` +
      `**${exampleHabitPct}%**, это дыра.»`,
    '',
    '## Итог',
    '1–2 короткие фразы с главной цифрой недели жирным.',
    'Потом цитата `> ...` — одной фразой главный вывод.',
    `Пример: «**${overallRate(data)}%** — это и есть неделя. Делай выводы.»`,
    '  `> Следующие 7 дней — не про количество, а про **три приоритета**.`',
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
    'Напиши полный отчёт: все семь разделов, минимум 400 слов, ' +
      'жирные числа/имена в каждой секции, списки или цитата в «Итог». ' +
      'Начни с «## Вступление» и закончи «## Итог».',
  ];

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userParts.join('\n') },
  ];
}
