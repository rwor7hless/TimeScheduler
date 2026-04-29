# Tasks rework: статус → done, ночная архивация, проекты, drag-and-drop

**Дата:** 2026-04-29
**Ветка контекста:** `feature/backend-nestjs-port`

## Проблема

1. Статусы `todo / in_progress / done` ничего не значат для пользователя — ручное переключение неудобно. Канбан-вид давно не используется.
2. Задачи в «Сегодня» накапливаются: завершённые остаются висеть второй день, потому что `my_day` никогда не сбрасывается, и нет ночной чистки.
3. Нет очевидной привязки задачи к проекту при создании. У `Task` есть `board_id`, но в UI он спрятан в модалке.
4. Нет ручного порядка задач в списке — порядок диктуется датами и эвристикой.

## Цели

- Статус задачи — бинарный: выполнено / не выполнено.
- В 00:00 по `USER_TIMEZONE` бэкенд-крон чистит «Сегодня»: выполненные → в архив (с сохранением `board_id`), невыполненные с дедлайном — становятся «Просрочено», `my_day` сбрасывается, recurring оживают.
- При создании задачи можно выбрать проект (компактным дропдауном). По умолчанию — без проекта.
- На строке задачи в списке справа отображается приглушённая пометка проекта.
- Задачи в списке можно реордерить drag-and-drop'ом, плавно, внутри секции.

## Не цели (out of scope)

- Кросс-секционный drag-and-drop (`Сегодня` → `Завтра` с автопереписыванием даты). Откладываем.
- Множественная привязка задачи к нескольким проектам.
- UI «Архив проекта X» как отдельный экран. Пока достаточно `is_archived=true` + фильтр по `board_id`, который уже есть в существующем экспорте/запросах.

## Удаляемое

`frontend/src/pages/KanbanPage.tsx` удаляется. Файл больше нигде не импортируется (`App.tsx` уже перенаправил `/kanban` → `/project` и `/kanban/:boardId` → `/project/:boardId`), но сам файл лежит и тащит зависимости от `KanbanStatus` / `kanban_order`, поэтому без удаления компиляция упадёт после миграции. Существующие redirect-маршруты в `App.tsx:55-57` оставляем — они не ссылаются на `KanbanPage` напрямую (`KanbanRedirect` использует только `useParams`).

`TaskCard.tsx` НЕ удаляется — он используется в `DayView` и `WeekView` календаря. В нём правится единственная строка `task.status === 'done'` → `task.done` (строка 44).

## Архитектура изменений

Пять связанных, но самостоятельных кусков. Можно мерджить порциями, но в рамках одного спека:

| # | Кусок | Слой | Зависимости |
|---|---|---|---|
| 1 | Бинарный статус (`done`) и переименование `kanban_order` → `position` | DB + бэкенд + фронт | Подготовительный |
| 2 | Полуночный крон `tasks-cleanup` | Бэкенд | Зависит от (1): использует `done` |
| 3 | Реордер на `position` через batch endpoint | Бэкенд + фронт | Зависит от (1) |
| 4 | Project picker при создании | Фронт | Независим |
| 5 | Project badge на строке | Фронт | Независим |

## 1. Модель данных и миграция

### Изменения схемы

```diff
  model Task {
    ...
-   status          KanbanStatus
-   kanban_order    Int
+   done            Boolean      @default(false)
+   position        Int          @default(0)
    completed_at    DateTime?
    ...
  }

- enum KanbanStatus { todo  in_progress  done }
```

Индекс `ix_tasks_user_board_status` пересобирается на `(user_id, board_id, position)` — он покрывает и список задач по проекту, и сортировку.

### Миграция (одна Prisma migration)

1. `ALTER TABLE tasks ADD COLUMN done BOOLEAN NOT NULL DEFAULT false`.
2. `UPDATE tasks SET done = true WHERE status = 'done'`. (`in_progress` → `done = false`.)
3. `ALTER TABLE tasks RENAME COLUMN kanban_order TO position`. Старые значения сохраняются.
4. `ALTER TABLE tasks DROP COLUMN status`.
5. `DROP TYPE "KanbanStatus"`.
6. `DROP INDEX ix_tasks_user_board_status`; `CREATE INDEX ix_tasks_user_board_position ON tasks(user_id, board_id, position)`.

Всё в одной транзакции — Prisma это умеет.

### Затрагиваемые места на фронте

`status` сейчас читается в нескольких местах — все правятся одинаково (`task.status === 'done'` → `task.done`):

- `frontend/src/types/task.ts` — `KanbanStatus` удаляется, в `Task` / `TaskCreate` / `TaskUpdate` поле `status` заменяется на `done: boolean`.
- `frontend/src/pages/TodayPage.tsx` — строки 113, 253, 541, 606, 613.
- `frontend/src/pages/TodoListPage.tsx` — строки 82, 325.
- `frontend/src/components/tasks/TaskModal.tsx` — состояние `status`, тогглы и UI колонок (387–399) удаляются. Остаётся чекбокс «Выполнено» поверх существующего поля.
- `frontend/src/pages/ExportPage.tsx:108` — `<option value="in_progress">` удаляется. Фильтр статуса в экспорте схлопывается до «все / только выполненные / только не выполненные».
- `frontend/src/components/tasks/TaskCard.tsx:44` — строка `task.status === 'done'` → `task.done`. Файл сохраняется (используется календарём).
- `frontend/src/pages/KanbanPage.tsx` — удаляется (см. блок «Удаляемое»).

### Совместимость

Single-deploy, single-user, breaking change в API допустим. DTO обновляются синхронно с фронтом.

## 2. Полуночный крон чистки

**Файл:** `backend-node/src/tasks/tasks-cleanup.service.ts`. Регистрируется в `TasksModule`. Паттерн зеркалирует `BackupSchedulerService` / `ReportsSchedulerService`: `@Cron`, `isRunning`-флаг (защита от наложений), ошибки логируются и не пробрасываются.

### Расписание

```ts
@Cron('0 0 * * *', { name: 'today-cleanup', timeZone: this.config.userTimezone })
```

`USER_TIMEZONE` берётся из существующего `ConfigService`.

### Алгоритм

```
now            = текущий момент (00:00 user TZ — момент срабатывания крона)
yesterdayStart = now - 1 day        // 00:00 user TZ "вчера"
yesterdayEnd   = now                // 00:00 user TZ "сегодня"
yesterdayDow   = weekday(yesterdayStart)   // 0=Пн … 6=Вс

candidates = task.findMany({
  is_archived: false,
  deleted_at: null,
  OR: [
    { scheduled_start: { gte: yesterdayStart, lt: yesterdayEnd } },
    { deadline:        { gte: yesterdayStart, lt: yesterdayEnd } },
    { my_day: true },
    { repeat_days: { has: yesterdayDow } },
  ],
})

archiveIds = []; resetIds = []; myDayClearIds = []; schedClearIds = []

for t in candidates:
  isRecurring         = t.repeat_days?.length > 0
  hadDeadlineYesterday = t.deadline ∈ [yesterdayStart, yesterdayEnd)
  scheduledYesterday   = t.scheduled_start ∈ [yesterdayStart, yesterdayEnd)

  if t.done:
    isRecurring ? resetIds.push(t.id) : archiveIds.push(t.id)
    continue

  // Невыполненные:
  if t.my_day:
    myDayClearIds.push(t.id)            // my_day всегда сбрасываем у невыполненных
  if scheduledYesterday and not isRecurring and not hadDeadlineYesterday:
    schedClearIds.push(t.id)            // scheduled-only → бэклог
  // hadDeadlineYesterday без scheduled — оставляем как есть, попадёт в "Просрочено"

prisma.$transaction([
  updateMany({ id: { in: archiveIds }      }, { is_archived: true }),
  updateMany({ id: { in: resetIds }        }, { done: false, completed_at: null }),
  updateMany({ id: { in: myDayClearIds }   }, { my_day: false }),
  updateMany({ id: { in: schedClearIds }   }, { scheduled_start: null, scheduled_end: null }),
])

logger.log(`Cleanup: archived=${A} reset=${R} myDayCleared=${MD} schedCleared=${SC}`)
```

### Тонкости поведения

- **Recurring done → reset:** `done=false` И `completed_at=null`. Стата «выполнено сегодня» не приплюсует вчерашнее.
- **Пересекающиеся условия (`my_day=true` И `scheduled=вчера`):** оба `updateMany` сработают на одной строке, итог корректный.
- **`my_day=true` без вчерашнего scheduled и без вчерашнего deadline:** попадает в кандидаты по `my_day:true`, очищается через `myDayClearIds`.
- **Орфанная задача (`board_id=null`) и `done=true`:** просто `is_archived=true`, без проекта. Видна в общем архиве.
- **`hadDeadlineYesterday=true` И невыполнена:** оставляем как есть, появляется во вкладке «Просрочено» (логика уже в `TodayPage`).
- **`hadDeadlineYesterday=true` И `my_day=true` И невыполнена:** my_day всё равно сбрасываем (пин на «сегодня» теряет смысл, когда дедлайн в прошлом). Дедлайн остаётся, задача попадает в «Просрочено».

### Удаление on-visit чистки на фронте

`frontend/src/pages/TodayPage.tsx:428-475` — блок `cleanupRanRef` удаляется целиком. Его поведение полностью покрывает крон.

### Тесты

Unit-тест на `TasksCleanupService` с мок-prisma. Таблица входов:

| Случай | Ожидаемое действие |
|---|---|
| done, не recurring, scheduled=вчера | в `archiveIds` |
| done, recurring | в `resetIds`, не архивируется |
| not done, my_day=true, без даты | в `myDayClearIds` |
| not done, scheduled=вчера, не recurring | в `schedClearIds` |
| not done, deadline=вчера, без scheduled, без my_day | ничего (становится Просрочено) |
| not done, my_day=true И deadline=вчера | в `myDayClearIds` (deadline остаётся) |
| not done, recurring, scheduled=вчера | ничего (recurring остаётся активной) |
| done, не recurring, board_id=null | в `archiveIds` (орфан архивируется) |
| архив=true | не попадает в кандидаты |

## 3. Drag-and-drop реордер

### Бэкенд

Существующий `PATCH /api/tasks/reorder` принимает `{ status, ordered_ids }`. После того, как `status` уходит, DTO упрощается:

```ts
// kanban-reorder.dto.ts → переименовать в reorder.dto.ts
export class ReorderDto {
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  ordered_ids!: number[];
}
```

Сервис: транзакционно прописывает `position = i` каждому `id` из массива. Если массив пустой — `{ok: true}` без действий (старое поведение). Никакой группировки по статусу больше нет: реордер — это полная картина одной секции.

### Фронтенд

- `frontend/src/hooks/useTasks.ts`: `useReorderTasks` упрощается — body становится `{ ordered_ids }`, оптимистичное обновление кэша TanStack Query (переставляет элементы локально, не дожидаясь бэкенда).
- `TodayPage.tsx`:
  - Каждая секция (Сегодня, Просрочено, Завтра, Послезавтра, …, Позднее, Отложенное) обёрнута в отдельный `<DndContext>` + `<SortableContext>`. Дроп между секциями не разрешён (`SortableContext` ограничен своей секцией).
  - Каждая `TodayTaskRow` / `BacklogTaskRow` — `useSortable` элемент.
  - На `onDragEnd`: вычисляем новый порядок секции, оптимистично переставляем в кэше, шлём `PATCH /api/tasks/reorder { ordered_ids }`.
- Сортировка внутри секции: `ORDER BY position ASC, COALESCE(scheduled_start, deadline, created_at) ASC`. Если у задач одинаковый `position` (например, после миграции у всех `0` в неполных секциях), фолбэк по дате/времени даёт стабильный порядок.

### Анимация

- `@dnd-kit/sortable` сам анимирует transform во время drag.
- При reflow после drop — `framer-motion` `<motion.div layout>` на каждой строке: соседи плавно сдвигаются на свои места.
- Длительность ~200мс, easing `ease-out`. Никаких bounce/spring.

### Тесты

- Бэкенд: integration-тест на `/reorder` с пустым массивом, с не-владельческими id (отбрасываются), с обычным случаем.
- Фронтенд: смок-тест вручную (drag в Сегодня, drag в Завтра, проверка что порядок персистнул после refresh).

## 4. Project picker при создании

### Quick-add (компонент `ProjectChip`)

Новый компонент `frontend/src/components/tasks/ProjectChip.tsx`:

- Маленькая «таблетка» рядом с `+` кнопкой quick-add.
- Дефолт: «Без проекта», без цвета.
- Клик → выпадает список из `useBoards()` + первый пункт «Без проекта».
- Selected state: имя проекта + `×` для очистки.
- Состояние локальное в `TodayPage` (`selectedBoardId: number | null`).
- Не персистится в `localStorage` — каждый visit начинается с «Без проекта» (явное решение пользователя).

`handleQuickAdd` пробрасывает `selectedBoardId` в payload `createTask` как `board_id`. После успешного создания — `selectedBoardId` сбрасывается в `null`.

### TaskModal

В `TaskModal` уже есть `board_id` (см. `frontend/src/components/tasks/TaskModal.tsx:231,278`). Проверяем визуально, что поле «Проект» там понятное и компактное; иначе — мелкая полировка стилей. Значимых изменений нет.

### Бэкенд

DTO `task-create.dto.ts` уже принимает `board_id?: number | null`. Сервис прокидывает в Prisma. Изменений нет.

## 5. Project badge на строке задачи

В `TodayTaskRow` и `BacklogTaskRow` добавляется небольшой текст с именем проекта **справа**, между блоком тегов и блоком даты:

- Шрифт: `text-[10px] font-medium`, цвет `text-gray-400 dark:text-gray-500` (приглушённый).
- Позиция: между `<TagBadgeGroup>` и `<dateLabel>` (см. `TodayPage.tsx:194-211`).
- Только если `task.board_id != null`. Имя берём из локального словаря `boardsById` (мемоизировано из `useBoards()`).
- Truncate: `max-w-[80px] truncate`. Если имя длинное — обрежется с многоточием.
- Не показываем для `done` задач (они уже зачёркнуты, лишний шум).

Никакого фона, никакой цветной точки. Просто текст. Приглушённо, как просил пользователь.

## Тесты и rollout

### Бэкенд

- Unit:
  - `tasks-cleanup.service.spec.ts` — таблица из раздела (2).
  - `tasks.service.spec.ts` — обновляется под новый `reorder` (без `status`), новые поля `done` / `position`. Старые тесты с `kanban_order` правятся одной find-and-replace.
- Integration:
  - `/reorder` — новые сценарии.
  - Миграция прогоняется на тестовой БД с фикстурой существующих задач (todo/in_progress/done) → проверяем `done` flag и сохранность `position`.

### Фронтенд

- Manual smoke:
  - Создать задачу через quick-add без проекта → попадает в «Сегодня».
  - Создать задачу через quick-add с выбранным проектом → видна с приглушённой пометкой проекта.
  - Поставить чекбокс на задаче → она становится зачёркнутой, остаётся в «Сегодня» до полуночи.
  - Перетащить задачу на новую позицию в «Сегодня» → плавно перестроилось, refresh страницы — порядок сохранился.
  - Симулировать переход через полночь (вызвать крон вручную) → выполненные ушли в `is_archived=true`, my_day сбросился, recurring done сбросилась.

### Rollout

Один deploy. Миграция прогоняется автоматически в `prisma migrate deploy` на старте контейнера (NestJS делает это в bootstrap, см. существующий `bootstrap/`). Откат: миграция down (Prisma генерирует) восстанавливает `status` enum и `kanban_order`, но содержимое старого `status` для `in_progress` потеряется (всё, что было `in_progress`, останется `todo` после rollback). Это допустимо — single-user, риск низкий.

## Открытые вопросы

Нет.
