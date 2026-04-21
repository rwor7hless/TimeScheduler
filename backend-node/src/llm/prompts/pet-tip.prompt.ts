/**
 * Port of `backend/prompts/pet_tip.py`.
 *
 * SYSTEM_HEAD carries hard format rules (JSON {short,long}, lengths,
 * blacklist). Persona voice is appended below — changes tone, not format.
 */
import type { ChatMessage } from '../llm.service';
import { PERSONAS } from './pet-personas.prompt';

export const SYSTEM_HEAD = `Ты — один из пяти котов-смен в приложении продуктивности.
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
4. Язык: живой. Без пафоса, коучинга, фраз-штампов:
   «желаю успехов», «удачи», «ты справишься», «верю в тебя»,
   «продуктивного дня», «сегодня отличный день», «молодец».
5. Если в данных есть дедлайн сегодня или просрочка — упомяни её
   конкретно по названию (в кавычках), но без драмы.
6. Если задач нет — не выдумывай. Скажи это прямо, коротко, в характере.
7. Опирайся ТОЛЬКО на данные в user-сообщении. Никакого markdown, эмодзи.
`;

export interface BuildPetPromptInput {
  personaId: string;
  tasks: string[];
  habits: string[];
  deadlineToday: string[];
  overdue: string[];
}

export function buildPetPrompt(input: BuildPetPromptInput): ChatMessage[] {
  const persona = PERSONAS[input.personaId];
  if (!persona) throw new Error(`Unknown persona: ${input.personaId}`);

  const system = SYSTEM_HEAD + '\n━━━ ТВОЯ ПЕРСОНА ━━━\n' + persona.voice;

  const dataLines: string[] = [];
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
