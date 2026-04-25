/**
 * Port of `backend/prompts/pet_tip.py`.
 *
 * SYSTEM_HEAD carries hard format rules (JSON {short,long}, lengths,
 * blacklist). Persona voice is appended below — changes tone, not format.
 */
import type { ChatMessage } from '../llm.service';
import { PERSONAS } from './pet-personas.prompt';

export const SYSTEM_HEAD = `Ты — один из семи котов-смен в приложении продуктивности.
Какой именно — скажет блок ниже.

━━━ ЖЁСТКИЕ ПРАВИЛА ━━━
1. Формат ответа: строго JSON вида
   {"short": "...", "long": "..."}
   Никакого текста до/после, никакого markdown-обрамления, никаких \`\`\`.
2. Длина:
   - short: 1 предложение, не более 100 символов.
   - long:  1–2 предложения, не более 260 символов.
   long развивает ту же мысль, что short, добавляя ОДНО пояснение,
   следствие или совет. Это не цитата short — это его продолжение
   в том же голосе.
3. Обращение: на «ты», от первого лица (я-кот).
4. Язык: живой и конкретный. Берёшь из голоса персоны яркие глаголы и
   образы, не сваливаешься в общие фразы. Без пафоса, коучинга,
   фраз-штампов: «желаю успехов», «удачи», «ты справишься»,
   «верю в тебя», «продуктивного дня», «сегодня отличный день», «молодец».
5. Если в данных есть дедлайн сегодня или просрочка — упомяни её
   конкретно по названию (в кавычках), но без драмы.
6. Если задач нет — не выдумывай. Скажи это прямо, коротко, в характере.
7. Если в данных есть день недели или часть суток — допустимо к ним
   аккуратно отсылать (но не цитируй буквально, а живи в моменте).
8. Опирайся ТОЛЬКО на данные в user-сообщении. Никакого markdown, эмодзи.
9. Не повторяй формулировки между short и long. Это два штриха одной мысли,
   не одно и то же другими словами.
`;

export type TimeOfDay =
  | 'раннее утро'
  | 'утро'
  | 'день'
  | 'вечер'
  | 'поздний вечер'
  | 'ночь';

export interface BuildPetPromptInput {
  personaId: string;
  tasks: string[];
  habits: string[];
  deadlineToday: string[];
  overdue: string[];
  /** "понедельник", "суббота" etc. — добавляется в данные, если задано. */
  dayOfWeek?: string;
  /** "утро", "ночь" etc. — добавляется в данные, если задано. */
  timeOfDay?: TimeOfDay;
  /** true если суббота/воскресенье — даёт коту понять, что выходной. */
  isWeekend?: boolean;
}

export function timeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 8) return 'раннее утро';
  if (hour >= 8 && hour < 12) return 'утро';
  if (hour >= 12 && hour < 18) return 'день';
  if (hour >= 18 && hour < 21) return 'вечер';
  if (hour >= 21 && hour < 23) return 'поздний вечер';
  return 'ночь';
}

const RUSSIAN_WEEKDAYS = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];

const SHORT_WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Индекс дня недели (0 = вс, 6 = сб) с учётом опциональной таймзоны. */
export function weekdayIndexInTz(date: Date, timezone?: string): number {
  if (timezone) {
    try {
      const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(
        date,
      );
      const idx = SHORT_WEEKDAY_TO_INDEX[wd];
      if (idx !== undefined) return idx;
    } catch {
      /* fallthrough */
    }
  }
  return date.getDay();
}

export function dayOfWeekRu(date: Date, timezone?: string): string {
  return RUSSIAN_WEEKDAYS[weekdayIndexInTz(date, timezone)];
}

export function isWeekendInTz(date: Date, timezone?: string): boolean {
  const idx = weekdayIndexInTz(date, timezone);
  return idx === 0 || idx === 6;
}

export function buildPetPrompt(input: BuildPetPromptInput): ChatMessage[] {
  const persona = PERSONAS[input.personaId];
  if (!persona) throw new Error(`Unknown persona: ${input.personaId}`);

  const system = SYSTEM_HEAD + '\n━━━ ТВОЯ ПЕРСОНА ━━━\n' + persona.voice;

  const dataLines: string[] = [];

  // Контекст дня — мягкая отсылка, чтобы кот не цитировал буквально
  const ctxParts: string[] = [];
  if (input.dayOfWeek) ctxParts.push(input.dayOfWeek);
  if (input.timeOfDay) ctxParts.push(input.timeOfDay);
  if (input.isWeekend) ctxParts.push('выходной');
  if (ctxParts.length > 0) {
    dataLines.push('Контекст дня: ' + ctxParts.join(', '));
  }

  if (input.tasks.length > 0) {
    dataLines.push(
      'Задачи на сегодня (My Day / расписание): ' + input.tasks.map((t) => `«${t}»`).join(', '),
    );
  } else {
    dataLines.push('Задач в My Day или расписании нет.');
  }
  if (input.deadlineToday.length > 0) {
    dataLines.push('Дедлайн сегодня: ' + input.deadlineToday.map((t) => `«${t}»`).join(', '));
  }
  if (input.overdue.length > 0) {
    dataLines.push(
      'Просроченные задачи (давно висят): ' + input.overdue.map((t) => `«${t}»`).join(', '),
    );
  }
  if (input.habits.length > 0) {
    dataLines.push('Привычки: ' + input.habits.join(', '));
  }

  const userContent =
    '━━━ ДАННЫЕ ━━━\n' +
    dataLines.join('\n') +
    '\n\n' +
    'Ответь JSON-ом {"short": "...", "long": "..."} в голосе персоны ' +
    'из system-сообщения. Без markdown, без эмодзи, без штампов.';

  return [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ];
}
