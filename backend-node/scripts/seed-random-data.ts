/**
 * Засевает БД случайными, но реалистичными данными для админа.
 * Не создаёт нового пользователя — берёт первого админа из базы.
 * Ничего не удаляет — просто докидывает кучу задач / привычек / транзакций.
 *
 * Запуск из backend-node/:
 *   npx ts-node --transpile-only scripts/seed-random-data.ts
 */
import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { PrismaClient, Priority, KanbanStatus } from '@prisma/client';

// ── Русский «контент» — задачи, описания, привычки, покупки ────────────────

const BOARD_NAMES = ['Работа', 'Дом', 'Учёба', 'Саморазвитие'];

const TAG_POOL: Array<{ name: string; color: string }> = [
  { name: 'срочно',   color: '#EF4444' },
  { name: 'важное',   color: '#F59E0B' },
  { name: 'дом',      color: '#8B5CF6' },
  { name: 'работа',   color: '#3B82F6' },
  { name: 'встреча',  color: '#10B981' },
  { name: 'созвон',   color: '#06B6D4' },
  { name: 'чтение',   color: '#84CC16' },
  { name: 'код',      color: '#6366F1' },
  { name: 'идея',     color: '#EC4899' },
];

const WORK_TASKS = [
  'Подготовить отчёт за квартал',
  'Созвон с командой по roadmap',
  'Ревью PR от Ивана',
  'Задеплоить хотфикс в прод',
  'Обновить документацию API',
  'Проверить алерты в Grafana',
  'Обсудить архитектуру сервиса уведомлений',
  'Разобрать почту',
  'Собеседование джуна',
  'Закрыть задачи в Jira',
  'Написать postmortem по инциденту',
  'Рефакторинг модуля auth',
  'Поставить метрики на новый эндпоинт',
  'Синк с продактом',
  'Обновить зависимости',
];

const HOME_TASKS = [
  'Купить продукты',
  'Помыть машину',
  'Полить цветы',
  'Разобрать балкон',
  'Починить кран на кухне',
  'Вынести мусор',
  'Забрать посылку с почты',
  'Позвонить маме',
  'Записаться к стоматологу',
  'Перебрать шкаф',
  'Пропылесосить',
  'Постирать бельё',
  'Приготовить ужин',
  'Сменить фильтр в воде',
];

const STUDY_TASKS = [
  'Глава 7 учебника по Rust',
  'Лекция про вектора БД',
  'Пройти курс по системному дизайну',
  'Решить 10 задач на leetcode',
  'Прочитать статью про gRPC',
  'Сделать домашку по английскому',
  'Посмотреть доклад с Highload',
  'Законспектировать главу про DDD',
];

const GROWTH_TASKS = [
  'Пробежка 5 км',
  'Медитация 15 минут',
  'Написать в дневнике',
  'Поиграть на гитаре',
  'Зал — спина + бицепс',
  'Йога утром',
  'Сходить на массаж',
  'Не залипать в телефон вечером',
];

const INBOX_TASKS = [
  'Придумать подарок на др',
  'Забронировать билеты в Питер',
  'Посмотреть фильм Оппенгеймер',
  'Попробовать новую кофейню на районе',
  'Вернуть книгу в библиотеку',
];

const HABITS = [
  { name: 'бег',           color: '#10B981', desc: '5 км в лёгком темпе' },
  { name: 'чтение',        color: '#84CC16', desc: '30 страниц вечером' },
  { name: 'медитация',     color: '#8B5CF6', desc: '10 минут с утра' },
  { name: 'английский',    color: '#06B6D4', desc: '15 слов в Anki' },
  { name: 'зал',           color: '#F59E0B', desc: null },
  { name: 'без сахара',    color: '#EC4899', desc: 'никаких сладостей' },
  { name: '8 часов сна',   color: '#6366F1', desc: 'ложиться до 23:30' },
];

const BUDGET_TAGS: Array<{ name: string; color: string }> = [
  { name: 'работа',    color: '#3B82F6' },
  { name: 'семья',     color: '#EC4899' },
  { name: 'друзья',    color: '#F59E0B' },
  { name: 'один',      color: '#6366F1' },
  { name: 'с собой',   color: '#10B981' },
  { name: 'наличка',   color: '#9CA3AF' },
  { name: 'карта',     color: '#06B6D4' },
];

const EXPENSE_CATS = [
  'food', 'transport', 'housing', 'health', 'entertainment',
  'clothing', 'tech', 'education', 'travel', 'subscriptions', 'other',
];

const EXPENSE_DESCRIPTIONS: Record<string, string[]> = {
  food:          ['Продукты в Пятёрочке', 'Обед на работе', 'Кофе с собой', 'Доставка роллов', 'Пекарня', 'Шаверма', 'Супермаркет', 'Завтрак в кафе'],
  transport:     ['Метро', 'Такси домой', 'Бензин на заправке', 'Каршеринг', 'Парковка в центре', 'Автобус', 'Мойка авто'],
  housing:       ['Квартплата', 'Электричество', 'Интернет', 'Мебель из IKEA', 'Ремонт крана', 'Моющие средства'],
  health:        ['Аптека', 'Стоматолог', 'Витамины', 'Массаж', 'Анализы в лабе', 'Осмотр у терапевта'],
  entertainment: ['Билеты в кино', 'Подписка на игры', 'Бар с друзьями', 'Концерт', 'Боулинг', 'Настолки'],
  clothing:      ['Кроссовки', 'Джинсы', 'Куртка на осень', 'Футболка', 'Носки (комплект)', 'Рубашка'],
  tech:          ['Клавиатура', 'SSD на 1TB', 'Чехол для телефона', 'Монитор', 'Наушники'],
  education:     ['Курс по системному дизайну', 'Учебник по английскому', 'Udemy подписка', 'Книга Cracking the Coding Interview'],
  travel:        ['Билеты в Питер', 'Hotel booking', 'Жд билеты', 'Такси до аэропорта'],
  subscriptions: ['Яндекс Плюс', 'Spotify', 'Apple iCloud', 'VPN', 'ChatGPT Plus'],
  other:         ['Непонятный списание', 'Разное', 'Подарок', 'Комиссия банка'],
};

const INCOME_DESCRIPTIONS = ['Зарплата', 'Аванс', 'Фриланс-проект', 'Возврат долга', 'Кешбек'];

// ── Утилиты ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): number {
  const v = Math.random() * (max - min) + min;
  const m = Math.pow(10, decimals);
  return Math.round(v * m) / m;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function randomTimeOn(date: Date, hourMin = 8, hourMax = 20): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(randInt(hourMin, hourMax), [0, 15, 30, 45][randInt(0, 3)], 0, 0);
  const end = new Date(start);
  end.setMinutes(start.getMinutes() + [30, 45, 60, 90, 120][randInt(0, 4)]);
  return { start, end };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let url = process.env.DATABASE_URL_PRISMA ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Neither DATABASE_URL_PRISMA nor DATABASE_URL is set');
  // Python backend uses `postgresql+asyncpg://` — Prisma can't parse it.
  url = url.replace(/^postgresql\+asyncpg:\/\//, 'postgresql://');

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const user = await prisma.user.findFirst({
      where: { is_admin: true },
      orderBy: { id: 'asc' },
    });
    if (!user) throw new Error('Админа не нашёл. Запусти сперва backend, чтобы он создал админа.');
    const userId = user.id;
    console.log(`→ seeding for user #${userId} (${user.username})`);

    // ── Boards ─────────────────────────────────────────────────────────────
    const boards = [];
    for (const name of BOARD_NAMES) {
      const existing = await prisma.board.findFirst({ where: { user_id: userId, name } });
      const board = existing ?? (await prisma.board.create({ data: { user_id: userId, name } }));
      boards.push(board);
    }
    console.log(`  ✔ ${boards.length} boards`);

    // ── Tags ───────────────────────────────────────────────────────────────
    const tags = [];
    for (const t of TAG_POOL) {
      const tag = await prisma.tag.upsert({
        where: { user_id_name: { user_id: userId, name: t.name } },
        update: { color: t.color },
        create: { user_id: userId, name: t.name, color: t.color },
      });
      tags.push(tag);
    }
    console.log(`  ✔ ${tags.length} tags`);

    // ── Tasks ──────────────────────────────────────────────────────────────
    const boardTaskPools: Record<string, string[]> = {
      Работа: WORK_TASKS,
      Дом: HOME_TASKS,
      Учёба: STUDY_TASKS,
      Саморазвитие: GROWTH_TASKS,
    };

    const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const statuses: KanbanStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

    let taskCount = 0;
    for (const board of boards) {
      const pool = boardTaskPools[board.name] ?? [];
      const toCreate = pickN(pool, Math.min(pool.length, randInt(6, 10)));
      let order = 0;
      for (const title of toCreate) {
        const status = pick(statuses);
        const isDone = status === 'DONE';
        const hasDeadline = Math.random() < 0.45;
        const hasSchedule = Math.random() < 0.30;
        const isMyDay = Math.random() < 0.20;
        const isArchived = !isDone && Math.random() < 0.08;
        const priority = pick(priorities);

        const createdOffset = randInt(0, 45);
        const created = daysAgo(createdOffset);
        const completed = isDone ? daysAgo(randInt(0, createdOffset)) : null;
        const deadline = hasDeadline
          ? daysAgo(-randInt(-10, 14)) // mix of past/future
          : null;
        const schedule = hasSchedule ? randomTimeOn(daysAgo(-randInt(-3, 5))) : null;

        const task = await prisma.task.create({
          data: {
            user_id: userId,
            board_id: board.id,
            title,
            description: Math.random() < 0.4 ? `детали по «${title.toLowerCase()}»` : null,
            priority,
            status,
            kanban_order: order++,
            created_at: created,
            updated_at: completed ?? created,
            completed_at: completed,
            deadline,
            scheduled_start: schedule?.start ?? null,
            scheduled_end: schedule?.end ?? null,
            my_day: isMyDay,
            is_archived: isArchived,
            repeat_days: Math.random() < 0.1 ? pickN([0, 1, 2, 3, 4, 5, 6], randInt(1, 4)) : [],
            color: pick(['#6B7280', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']),
          },
        });
        taskCount++;

        // subtasks для ~20% задач
        if (Math.random() < 0.2) {
          const nSubs = randInt(2, 4);
          for (let i = 0; i < nSubs; i++) {
            await prisma.task.create({
              data: {
                user_id: userId,
                board_id: board.id,
                parent_id: task.id,
                title: `подпункт ${i + 1}`,
                priority: 'MEDIUM',
                status: i === 0 ? 'DONE' : pick(['TODO', 'IN_PROGRESS']),
                kanban_order: i,
                completed_at: i === 0 ? daysAgo(randInt(0, createdOffset)) : null,
                repeat_days: [],
              },
            });
            taskCount++;
          }
        }

        // 0–3 тегов
        const taskTags = pickN(tags, randInt(0, 3));
        for (const tag of taskTags) {
          await prisma.taskTag.create({ data: { task_id: task.id, tag_id: tag.id } });
        }
      }
    }

    // Inbox — задачи без доски
    for (const title of pickN(INBOX_TASKS, 4)) {
      await prisma.task.create({
        data: {
          user_id: userId,
          title,
          priority: pick(priorities),
          status: pick(['TODO', 'IN_PROGRESS']),
          kanban_order: 0,
          repeat_days: [],
          my_day: Math.random() < 0.3,
        },
      });
      taskCount++;
    }
    console.log(`  ✔ ${taskCount} tasks (incl. subtasks)`);

    // ── Habits + logs ──────────────────────────────────────────────────────
    let habitLogCount = 0;
    for (const h of HABITS) {
      const habit = await prisma.habit.create({
        data: {
          user_id: userId,
          name: h.name,
          description: h.desc,
          color: h.color,
          is_active: Math.random() < 0.9,
          created_at: daysAgo(randInt(30, 90)),
        },
      });

      // Логи за последние 60 дней со своей «постоянностью»
      const consistency = randFloat(0.3, 0.95, 2);
      for (let d = 0; d < 60; d++) {
        if (Math.random() < consistency) {
          const date = daysAgo(d);
          try {
            await prisma.habitLog.create({
              data: {
                habit_id: habit.id,
                date: new Date(toISODate(date)),
                completed_at: date,
              },
            });
            habitLogCount++;
          } catch {
            /* unique constraint — пропускаем дубли */
          }
        }
      }
    }
    console.log(`  ✔ ${HABITS.length} habits, ${habitLogCount} habit-logs`);

    // ── Budget tags ────────────────────────────────────────────────────────
    const budgetTags = [];
    for (const bt of BUDGET_TAGS) {
      const existing = await prisma.budgetTag.findFirst({ where: { user_id: userId, name: bt.name } });
      const tag = existing ?? (await prisma.budgetTag.create({ data: { user_id: userId, ...bt } }));
      budgetTags.push(tag);
    }
    console.log(`  ✔ ${budgetTags.length} budget tags`);

    // ── Transactions (за последние ~90 дней) ───────────────────────────────
    let txCount = 0;
    // доход: 2–3 раза в месяц
    for (let m = 0; m < 3; m++) {
      for (let i = 0; i < randInt(2, 3); i++) {
        const d = daysAgo(m * 30 + randInt(0, 29));
        const tx = await prisma.transaction.create({
          data: {
            user_id: userId,
            type: 'income',
            amount: randFloat(25000, 90000, 0),
            category: null,
            description: pick(INCOME_DESCRIPTIONS),
            date: toISODate(d),
          },
        });
        txCount++;
        // 50% — повесить 1 тег
        if (Math.random() < 0.5) {
          await prisma.transactionTag.create({
            data: { transaction_id: tx.id, tag_id: pick(budgetTags).id },
          });
        }
      }
    }

    // расход: 60–80 трат за 90 дней
    const nExpenses = randInt(60, 80);
    for (let i = 0; i < nExpenses; i++) {
      const daysBack = randInt(0, 90);
      const cat = pick(EXPENSE_CATS);
      const descPool = EXPENSE_DESCRIPTIONS[cat] ?? ['трата'];
      const amount = (() => {
        if (cat === 'housing') return randFloat(4500, 28000, 0);
        if (cat === 'tech')    return randFloat(2500, 45000, 0);
        if (cat === 'travel')  return randFloat(3000, 35000, 0);
        if (cat === 'clothing') return randFloat(1500, 9000, 0);
        if (cat === 'health')  return randFloat(400, 6000, 0);
        if (cat === 'subscriptions') return randFloat(299, 1499, 0);
        return randFloat(120, 2500, 0);
      })();
      const tx = await prisma.transaction.create({
        data: {
          user_id: userId,
          type: 'expense',
          amount,
          category: cat,
          description: pick(descPool),
          date: toISODate(daysAgo(daysBack)),
        },
      });
      txCount++;
      // 40% — 1 тег
      if (Math.random() < 0.4) {
        const bt = pick(budgetTags);
        try {
          await prisma.transactionTag.create({
            data: { transaction_id: tx.id, tag_id: bt.id },
          });
        } catch { /* ignore dup */ }
      }
    }
    console.log(`  ✔ ${txCount} transactions`);

    // ── Planned purchases (на текущий месяц) ───────────────────────────────
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;
    const planned = [
      { amount: 15000, cat: 'tech',          desc: 'Новые наушники' },
      { amount:  8500, cat: 'clothing',      desc: 'Ботинки на зиму' },
      { amount:  3200, cat: 'entertainment', desc: 'Билеты на концерт' },
      { amount: 25000, cat: 'travel',        desc: 'Поездка в Казань' },
      { amount:  1490, cat: 'subscriptions', desc: 'Годовая подписка' },
    ];
    for (const p of planned) {
      await prisma.plannedPurchase.create({
        data: {
          user_id: userId,
          year: thisYear,
          month: thisMonth,
          amount: p.amount,
          category: p.cat,
          description: p.desc,
          done: Math.random() < 0.2,
        },
      });
    }
    console.log(`  ✔ ${planned.length} planned purchases`);

    // ── Recurring transactions ─────────────────────────────────────────────
    const recurring = [
      { amount:  900, cat: 'subscriptions', desc: 'Яндекс Плюс',  day: 5 },
      { amount: 1199, cat: 'subscriptions', desc: 'Spotify',       day: 14 },
      { amount: 18000, cat: 'housing',      desc: 'Квартплата',    day: 10 },
    ];
    for (const r of recurring) {
      await prisma.recurringTransaction.create({
        data: {
          user_id: userId,
          type: 'expense',
          amount: r.amount,
          category: r.cat,
          description: r.desc,
          tag_ids: [],
          day_of_month: r.day,
          start_date: toISODate(daysAgo(180)),
          end_date: null,
          last_generated_date: toISODate(daysAgo(randInt(0, 28))),
          is_paused: false,
        },
      });
    }
    console.log(`  ✔ ${recurring.length} recurring transactions`);

    console.log('\n✅ seed done');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
