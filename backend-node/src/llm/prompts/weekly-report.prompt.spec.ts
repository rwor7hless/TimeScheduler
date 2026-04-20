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
      in_progress_tasks: [{ title: 'Рефакторинг', priority: 'низкий' }],
      todo_count: 3,
    },
    {
      name: 'Дом',
      done_tasks: [{ title: 'Убрать кухню', priority: 'низкий' }],
      overdue_tasks: [],
      in_progress_tasks: [],
      todo_count: 0,
    },
    {
      name: 'Без проекта',
      done_tasks: [],
      overdue_tasks: [{ title: 'Забытое', priority: 'средний', deadline: '05.04.2026' }],
      in_progress_tasks: [],
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
  it('has 18 banned phrases', () => {
    expect(BANNED_PHRASES).toHaveLength(18);
  });

  it('has 10 angle seeds', () => {
    expect(ANGLE_SEEDS).toHaveLength(10);
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
    expect(formatTone(10)).toMatch(/прямо и жёстко/);
    expect(formatTone(50)).toMatch(/честную критику/);
    expect(formatTone(90)).toMatch(/искренняя радость/);
  });

  it('aggregates totals from projects', () => {
    expect(totalDone(sampleData)).toBe(3);
    // done=3, overdue=2, in_progress=1, todo=4 → active=10 → 30%
    expect(overallRate(sampleData)).toBe(30);
  });

  it('formatDataBlock treats "Без проекта" as non-project bucket', () => {
    const out = formatDataBlock(sampleData);
    expect(out).toContain('── Задачи вне проектов (НЕ называй это проектом) ──');
    expect(out).toContain('── Проект «Работа» ──');
  });

  it('formatTemplate highlights best vs worst real project', () => {
    const out = formatTemplate(sampleData);
    // «Дом» has 100%, «Работа» has 20% → best=Дом, worst=Работа
    expect(out).toContain('лучший — **«Дом»**');
    expect(out).toContain('худший — **«Работа»**');
  });

  it('buildWeeklyPrompt matches the Python-generated golden file byte-for-byte', () => {
    const golden = fs.readFileSync(
      path.resolve(__dirname, '../../../test/fixtures/weekly-prompt-golden.txt'),
      'utf8',
    );
    const msgs = buildWeeklyPrompt(sampleData, { angleSeedIndex: 0 });
    const actual = `===SYSTEM===\n${msgs[0].content}\n===USER===\n${msgs[1].content}`;
    expect(actual).toBe(golden);
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
