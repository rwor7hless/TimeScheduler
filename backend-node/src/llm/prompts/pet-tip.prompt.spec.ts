import * as fs from 'fs';
import * as path from 'path';
import { ANGLE_SEEDS, SYSTEM_PROMPT, buildPetPrompt } from './pet-tip.prompt';

describe('pet-tip prompt', () => {
  it('exposes 8 angle seeds', () => {
    expect(ANGLE_SEEDS).toHaveLength(8);
  });

  it('SYSTEM_PROMPT enforces the 2-3 sentence rule', () => {
    expect(SYSTEM_PROMPT).toContain('РОВНО 2–3 предложения');
  });

  it('matches Python-generated golden byte-for-byte', () => {
    const golden = fs.readFileSync(
      path.resolve(__dirname, '../../../test/fixtures/pet-tip-golden.txt'),
      'utf8',
    );
    const msgs = buildPetPrompt({
      tasks: ['Написать отчёт', 'Созвон'],
      habits: ['бег', 'чтение'],
      deadlineToday: ['Оплатить счёт'],
      overdue: ['Старая задача'],
      angleSeedIndex: 0,
    });
    const actual = `===SYSTEM===\n${msgs[0].content}\n===USER===\n${msgs[1].content}`;
    expect(actual).toBe(golden);
  });

  it('falls back to "нет задач" line when tasks are empty', () => {
    const msgs = buildPetPrompt({
      tasks: [],
      habits: [],
      deadlineToday: [],
      overdue: [],
      angleSeedIndex: 0,
    });
    expect(msgs[1].content).toContain('Задач в My Day или расписании нет.');
  });

  it('omits the deadline line when none today', () => {
    const msgs = buildPetPrompt({
      tasks: ['X'],
      habits: [],
      deadlineToday: [],
      overdue: [],
      angleSeedIndex: 0,
    });
    expect(msgs[1].content).not.toContain('Дедлайн сегодня');
  });
});
