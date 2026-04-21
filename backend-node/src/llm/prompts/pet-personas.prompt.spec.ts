import { PERSONAS, parseAndValidate, pickPersona } from './pet-personas.prompt';

describe('pet-personas', () => {
  it('exposes exactly 5 personas', () => {
    expect(Object.keys(PERSONAS).sort()).toEqual(
      ['blin', 'plyushka', 'shprot', 'suhar', 'valeryan'].sort(),
    );
  });

  describe('pickPersona', () => {
    it('is deterministic for (userId, date)', () => {
      const input = {
        userId: 42,
        todayIso: '2026-04-21',
        tasksCount: 0,
        overdueCount: 0,
        deadlineTodayCount: 0,
        hour: 14,
      };
      const a = pickPersona(input);
      const b = pickPersona(input);
      expect(a).toBe(b);
      expect(PERSONAS[a]).toBeDefined();
    });

    it('weighs Сухарь heavier when there are overdues', () => {
      // run across many users; overdue should skew distribution toward suhar
      let suharCount = 0;
      const N = 200;
      for (let uid = 0; uid < N; uid++) {
        const id = pickPersona({
          userId: uid,
          todayIso: '2026-04-21',
          tasksCount: 1,
          overdueCount: 3,
          deadlineTodayCount: 0,
          hour: 14,
        });
        if (id === 'suhar') suharCount++;
      }
      // With 3× weight on suhar, expect > 1/5 baseline (40 out of 200).
      expect(suharCount).toBeGreaterThan(60);
    });
  });

  describe('parseAndValidate', () => {
    it('parses plain JSON', () => {
      const out = parseAndValidate('{"short": "s", "long": "l"}');
      expect(out).toEqual({ short: 's', long: 'l' });
    });

    it('strips markdown fences', () => {
      const out = parseAndValidate('```json\n{"short": "s", "long": "l"}\n```');
      expect(out).toEqual({ short: 's', long: 'l' });
    });

    it('truncates short over 100 chars', () => {
      const longShort = 'а'.repeat(150);
      const out = parseAndValidate(JSON.stringify({ short: longShort, long: 'l' }));
      expect(out.short.length).toBeLessThanOrEqual(100);
      expect(out.short.endsWith('…')).toBe(true);
    });

    it('throws on non-JSON', () => {
      expect(() => parseAndValidate('hello there')).toThrow(/не JSON/);
    });

    it('throws on missing fields', () => {
      expect(() => parseAndValidate('{"short": "s"}')).toThrow(/short\/long/);
    });

    it('throws on empty short', () => {
      expect(() => parseAndValidate('{"short": "", "long": "l"}')).toThrow(/пустой short/);
    });
  });
});
