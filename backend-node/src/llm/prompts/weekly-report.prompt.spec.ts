import * as fs from 'fs';
import * as path from 'path';
import {
  ANGLE_SEEDS,
  BANNED_PHRASES,
  DEFAULT_BUCKET,
  SYSTEM_PROMPT,
  WeeklyDataInput,
  buildWeeklyPrompt,
  formatDataBlock,
  formatTemplate,
  formatTone,
  overallRate,
  totalDone,
} from './weekly-report.prompt';

const sampleData: WeeklyDataInput = {
  week_start: '07.04.2026',
  week_end: '13.04.2026',
  projects: [
    {
      name: 'Работа',
      done_tasks: [
        { title: 'Написать отчёт', priority: 'высокий', deadline: '10.04.2026' },
        { title: 'Созвон с командой', priority: 'средний' },
      ],
      overdue_tasks: [{ title: 'Срочный фикс', priority: 'срочный', deadline: '08.04.2026' }],
      todo_count: 3,
    },
    {
      name: 'Дом',
      done_tasks: [{ title: 'Убрать кухню', priority: 'низкий' }],
      overdue_tasks: [],
      todo_count: 0,
    },
    {
      name: 'Без проекта',
      done_tasks: [],
      overdue_tasks: [{ title: 'Забытое', priority: 'средний', deadline: '05.04.2026' }],
      todo_count: 1,
    },
  ],
  habits: [
    { name: 'бег', done_days: 5 },
    { name: 'чтение', done_days: 2 },
  ],
  budget: {
    total_expense: 12500.5,
    total_income: 30000.0,
    top_categories: [
      ['еда', 5500.0],
      [null, 2000.0],
    ],
    avg_per_week: 10000.0,
    delta_pct: 25.0,
    planned_done: 3,
    planned_total: 5,
    overspent: [['развлечения', 3500.0, 2000.0]],
  },
};

describe('weekly-report prompt', () => {
  it('has 36 banned phrases', () => {
    expect(BANNED_PHRASES).toHaveLength(36);
  });

  it('has 8 angle seeds', () => {
    expect(ANGLE_SEEDS).toHaveLength(8);
  });

  it('DEFAULT_BUCKET is the untitled-project label', () => {
    expect(DEFAULT_BUCKET).toBe('Без проекта');
  });

  it('SYSTEM_PROMPT embeds every banned phrase literally', () => {
    for (const p of BANNED_PHRASES) {
      expect(SYSTEM_PROMPT).toContain(`— «${p}»`);
    }
  });

  it('formatTone branches on overall rate', () => {
    expect(formatTone(10)).toMatch(/сухо и честно/);
    expect(formatTone(50)).toMatch(/^ровно\./);
    expect(formatTone(90)).toMatch(/сдержанно-довольно/);
  });

  it('aggregates totals from projects', () => {
    expect(totalDone(sampleData)).toBe(3);
    // done=3, overdue=2, todo=4 → active=9 → 33%
    expect(overallRate(sampleData)).toBe(33);
  });

  it('formatDataBlock treats "Без проекта" as non-project bucket', () => {
    const out = formatDataBlock(sampleData);
    expect(out).toContain('── Задачи вне проектов (НЕ называй это проектом) ──');
    expect(out).toContain('── Проект «Работа» ──');
  });

  it('formatTemplate highlights best vs worst real project', () => {
    const out = formatTemplate(sampleData);
    // «Дом» has 100%, «Работа» has 20% → best=Дом, worst=Работа
    expect(out).toContain('**«Дом»**');
    expect(out).toContain('**«Работа»**');
    expect(out).toMatch(/лучший[\s\S]*«Дом»/);
    expect(out).toMatch(/худший[\s\S]*«Работа»/);
  });

  // Golden-fixture test временно отключен: промпт переписан под менее «ИИшный»
  // тон, и побайтовая сверка с Python-версией уже не актуальна (Python-сторона
  // ушла). Оставили ниже смоук-ассертов, проверяющих смысл: структура секций,
  // наличие ключевых блоков.
  it('SYSTEM_PROMPT enforces the new anti-AI voice rules', () => {
    expect(SYSTEM_PROMPT).toContain('## Вступление');
    expect(SYSTEM_PROMPT).toContain('## Оценка недели');
    expect(SYSTEM_PROMPT).toContain('## 3 совета на следующую неделю');
    expect(SYSTEM_PROMPT).toContain('## Итог');
    // не мотивационный тренер, а спокойный наблюдатель
    expect(SYSTEM_PROMPT).not.toMatch(/наставник|коуч|мотиватор/);
  });

  it('buildWeeklyPrompt without seed returns 2 messages', () => {
    const msgs = buildWeeklyPrompt(sampleData);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
  });

  it('formatDataBlock handles empty habits', () => {
    const out = formatDataBlock({ ...sampleData, habits: [] });
    expect(out).toContain('▸ ПРИВЫЧКИ: данных нет');
  });

  it('formatDataBlock omits budget block when all zeros', () => {
    const out = formatDataBlock({ ...sampleData, budget: null });
    expect(out).not.toContain('БЮДЖЕТ ЗА 7 ДНЕЙ');
  });
});
