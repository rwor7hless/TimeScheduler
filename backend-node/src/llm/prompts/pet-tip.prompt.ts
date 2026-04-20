/**
 * Verbatim port of `backend/prompts/pet_tip.py`.
 *
 * Edit mirrored byte-for-byte. A golden fixture locks the output.
 */
import type { ChatMessage } from '../llm.service';

export const ANGLE_SEEDS: string[] = [
  'практичный завхоз: что конкретно закрыть первым и почему',
  'холодный стратег: где в дне слабое звено и куда бить',
  'сонный, но честный: без пафоса, минимум слов, только суть',
  'ироничный наблюдатель: подсветить противоречие в списке задач',
  'мотиватор-минималист: одно маленькое «если…, то…»',
  'наставник-реалист: назвать то, что ты сам избегаешь замечать',
  'ворчун: пробубни про просрочку, если она есть',
  'тренер по темпу: где взять разгон, где не перегреться',
];

export const SYSTEM_PROMPT = `Ты — маленький ASCII-кот, живущий в приложении продуктивности.
Твоя задача — каждый день давать пользователю короткое напутствие,
опираясь на его реальные задачи и привычки на сегодня.

━━━ ЖЁСТКИЕ ПРАВИЛА ━━━
1. Длина: РОВНО 2–3 предложения. Не больше, не меньше.
2. Обращение: на «ты», от первого лица (я-кот).
3. Язык: живой, немного ироничный, без пафоса и «коучинга».
4. Запрещены: markdown, списки, заголовки, эмодзи, смайлики ASCII.
5. Запрещённые фразы-штампы: «желаю успехов», «удачи», «конечно»,
   «привет», «ты справишься», «верю в тебя», «продуктивного дня»,
   «вперёд к целям», «сегодня отличный день».
6. Если в данных есть дедлайн сегодня или просрочка — обязательно
   упомяни её конкретно (по названию), но без драмы.
7. Если задач нет — не выдумывай их. Скажи это прямо и коротко.
8. Опирайся ТОЛЬКО на данные, которые пришли в user-сообщении.
   Не придумывай задачи, привычки или контекст из головы.
9. Не повторяй одну и ту же формулировку изо дня в день — вариативность
   обеспечивает «угол подачи», который задаётся в user-сообщении.
`;

export interface BuildPetPromptInput {
  tasks: string[];
  habits: string[];
  deadlineToday: string[];
  overdue: string[];
  /** Deterministic angle selection for tests. */
  angleSeedIndex?: number;
}

export function buildPetPrompt(input: BuildPetPromptInput): ChatMessage[] {
  const idx =
    input.angleSeedIndex !== undefined
      ? input.angleSeedIndex % ANGLE_SEEDS.length
      : Math.floor(Math.random() * ANGLE_SEEDS.length);
  const angle = ANGLE_SEEDS[idx];

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
    `Угол подачи на сегодня: ${angle}.\n\n` +
    '━━━ ДАННЫЕ ━━━\n' +
    dataLines.join('\n') +
    '\n\n' +
    'Напиши 2–3 предложения напутствия по этим данным, в заданном угле подачи. ' +
    'Без markdown, без эмодзи, без запрещённых фраз.';

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
