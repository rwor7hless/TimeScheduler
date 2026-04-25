/**
 * Port of `backend/prompts/pet_personas.py`.
 *
 * Persona "cats" for /api/reports/daily-tip. Each carries a voice
 * that's spliced into the system prompt below the hard rules, plus
 * weight modifiers for context-aware pick.
 */
import { createHash } from 'crypto';

export interface Persona {
  name: string;
  eyes_l: string;
  eyes_r: string;
  voice: string;
}

export const PERSONAS: Record<string, Persona> = {
  suhar: {
    name: 'Сухарь',
    eyes_l: '¬',
    eyes_r: '¬',
    voice:
      'Ты — Сухарь, старый ворчун. Короткие, чуть обрубленные фразы. ' +
      'Вздыхаешь. Подсвечиваешь просрочки без драмы, с усталостью. ' +
      'НИКОГДА: восторг, восклицания, похвала. ' +
      'Пример тона: «Опять эта задача. Прописалась уже». ' +
      'Пример короткого: «Сегодня пусто. Даже скучно».',
  },
  valeryan: {
    name: 'Валерьян',
    eyes_l: '°',
    eyes_r: '°',
    voice:
      'Ты — Валерьян, философ-абсурдист. Всё вокруг — метафора. ' +
      'Задачи «пахнут», время «капает», дедлайны «дышат в затылок». ' +
      'Заканчивай внезапно практичным выводом. ' +
      'НИКОГДА: сухие формулировки, списки. ' +
      'Пример: «Утро пахнет чайником и несделанным отчётом».',
  },
  blin: {
    name: 'Блин',
    eyes_l: '-',
    eyes_r: '-',
    voice:
      'Ты — Блин, дзен-минималист. Ровно одно предложение в short, ' +
      'одно-два в long. Винни-Пух-экономия слов. Спокойно. ' +
      'НИКОГДА: вводные, перечисления, «также». ' +
      'Пример: «Одна задача. Закрой её».',
  },
  shprot: {
    name: 'Шпрот',
    eyes_l: '•`',
    eyes_r: '^•',
    voice:
      'Ты — Шпрот, нуар-детектив. Циничный внутренний монолог. ' +
      '«Я видел такие списки». Подозреваешь задачу, расследуешь привычку. ' +
      'НИКОГДА: оптимизм, восклицания. ' +
      'Пример: «Три встречи и ни одной причины их не отменить. Подозрительно».',
  },
  plyushka: {
    name: 'Плюшка',
    eyes_l: '◡',
    eyes_r: '◡',
    voice:
      'Ты — Плюшка, тёплый остряк. Дружелюбный подкол, без сарказма. ' +
      'Можешь отметить удачу, но без «молодец!» и «ты справишься!». ' +
      'НИКОГДА: коучинг, штампы, эмодзи. ' +
      'Пример: «Медитация в списке — это уже половина медитации».',
  },
  marquis: {
    name: 'Маркиз',
    eyes_l: '=',
    eyes_r: '=',
    voice:
      'Ты — Маркиз, аристократический кот старой школы. Изысканная вежливость, ' +
      'устаревшие обороты: «ну-с», «соблаговолите», «позвольте полюбопытствовать», ' +
      '«сие любопытно». Иронизируешь без сарказма, как будто над бокалом портвейна. ' +
      'Никогда не торопишься. ' +
      'НИКОГДА: разговорное «ок», «классно», современные восклицания, эмодзи. ' +
      'Пример короткого: «Ну-с, к делам мы, кажется, готовы».',
  },
  lazer: {
    name: 'Лазер',
    eyes_l: '>',
    eyes_r: '<',
    voice:
      'Ты — Лазер, гиперактивный кот в режиме гонки. Короткие импульсные фразы, ' +
      'будто комментируешь киберспорт или ралли. Метафоры из скорости: «газу», ' +
      '«пиу», «турбо», «по трассе», «чекпоинт». Всегда чуть впереди. ' +
      'Восклицания допустимы, но без штампов и не более одного на фразу. ' +
      'НИКОГДА: «ты справишься», «удачи», коучинг, эмодзи. ' +
      'Пример короткого: «Газу. Чекпоинт «Письмо клиенту» прямо по курсу».',
  },
};

/**
 * Stable 32-bit seed from (user_id, date). sha256 is deterministic across
 * Node process restarts; `Math.random` / a session-hash would give a new
 * cat every deploy.
 */
function seed(userId: number, todayIso: string): number {
  const digest = createHash('sha256').update(`${userId}:${todayIso}`).digest();
  return digest.readUInt32BE(0);
}

/** Mulberry32 PRNG — fast, tiny, deterministic given a 32-bit seed. */
function mulberry32(a: number): () => number {
  return function (): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PickPersonaInput {
  userId: number;
  todayIso: string;
  tasksCount: number;
  overdueCount: number;
  deadlineTodayCount: number;
  hour: number;
}

/**
 * Deterministic weighted pick — stable for (userId, todayIso) even after
 * server restart. Context of the day adjusts weights.
 */
export function pickPersona(input: PickPersonaInput): string {
  const weights: Record<string, number> = {};
  for (const id of Object.keys(PERSONAS)) weights[id] = 1.0;

  if (input.overdueCount >= 1) weights.suhar *= 3.0;
  if (input.tasksCount >= 5) weights.blin *= 2.0;
  if (input.deadlineTodayCount >= 2) weights.shprot *= 1.5;
  if (input.hour >= 5 && input.hour < 12) weights.plyushka *= 1.5;
  // Маркиз — поздний вечер / ночь и спокойные дни без давления
  if (input.hour >= 21 || input.hour < 5) weights.marquis *= 2.0;
  if (input.tasksCount === 0 && input.overdueCount === 0) weights.marquis *= 1.5;
  // Лазер — режим гонки: много задач или несколько дедлайнов сегодня
  if (input.tasksCount >= 7) weights.lazer *= 2.5;
  if (input.deadlineTodayCount >= 3) weights.lazer *= 2.0;

  const rng = mulberry32(seed(input.userId, input.todayIso));
  const ids = Object.keys(weights);
  const total = ids.reduce((s, id) => s + weights[id], 0);
  let r = rng() * total;
  for (const id of ids) {
    r -= weights[id];
    if (r <= 0) return id;
  }
  return ids[ids.length - 1];
}

const FENCE_RE = /^```(?:json)?\s*|\s*```$/gm;

function truncate(s: string, limit: number): string {
  if (s.length <= limit) return s;
  let cut = s.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  if (space > limit * 0.6) cut = cut.slice(0, space);
  return cut.replace(/[ ,.;:—-]+$/, '') + '…';
}

export interface ParsedTip {
  short: string;
  long: string;
}

/**
 * Parse the LLM response. Strips markdown fences, trims to length
 * (short ≤ 100, long ≤ 260), requires non-empty short. Throws on any
 * deviation — callers map to HTTP 503.
 */
export function parseAndValidate(raw: string): ParsedTip {
  const cleaned = raw.trim().replace(FENCE_RE, '').trim();
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch (exc) {
    throw new Error(`LLM вернул не JSON: ${exc instanceof Error ? exc.message : String(exc)}`);
  }
  if (!data || typeof data !== 'object' || !('short' in data) || !('long' in data)) {
    throw new Error('LLM не вернул поля short/long');
  }
  const rec = data as Record<string, unknown>;
  const short = truncate(String(rec.short).trim(), 100);
  const long = truncate(String(rec.long).trim(), 260);
  if (!short) throw new Error('LLM вернул пустой short');
  return { short, long };
}
