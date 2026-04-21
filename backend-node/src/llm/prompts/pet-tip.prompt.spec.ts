import { SYSTEM_HEAD, buildPetPrompt } from './pet-tip.prompt';
import { PERSONAS } from './pet-personas.prompt';

describe('pet-tip prompt', () => {
  it('SYSTEM_HEAD enforces JSON-only output', () => {
    expect(SYSTEM_HEAD).toContain('{"short": "...", "long": "..."}');
  });

  it('splices persona voice into system message', () => {
    const msgs = buildPetPrompt({
      personaId: 'suhar',
      tasks: ['X'],
      habits: [],
      deadlineToday: [],
      overdue: [],
    });
    expect(msgs[0].content).toContain(PERSONAS.suhar.voice);
    expect(msgs[0].content).toContain('ТВОЯ ПЕРСОНА');
  });

  it('falls back to "нет задач" line when tasks are empty', () => {
    const msgs = buildPetPrompt({
      personaId: 'blin',
      tasks: [],
      habits: [],
      deadlineToday: [],
      overdue: [],
    });
    expect(msgs[1].content).toContain('Задач в My Day или расписании нет.');
  });

  it('omits the deadline line when none today', () => {
    const msgs = buildPetPrompt({
      personaId: 'blin',
      tasks: ['X'],
      habits: [],
      deadlineToday: [],
      overdue: [],
    });
    expect(msgs[1].content).not.toContain('Дедлайн сегодня');
  });

  it('throws on unknown persona id', () => {
    expect(() =>
      buildPetPrompt({
        personaId: 'not-a-cat',
        tasks: [],
        habits: [],
        deadlineToday: [],
        overdue: [],
      }),
    ).toThrow(/Unknown persona/);
  });
});
