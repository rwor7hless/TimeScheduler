import { buildNav } from '@/lib/nav'

export interface CommandContext {
  navigate: (to: string) => void
  toggleTheme: () => void
  newTask: () => void
}

export interface Command {
  id: string
  label: string
  hint?: string
  run: (ctx: CommandContext) => void
}

/**
 * Навигационные команды строятся из того же buildNav, что рендерит Sidebar.
 * Спек требует именно этого: список, продублированный в двух местах, рано или
 * поздно разъезжается, и заметно это становится только по жалобе.
 */
export function buildCommands({ isAdmin }: { isAdmin: boolean }): Command[] {
  const nav = buildNav({ isAdmin })
    .flatMap((g) => g.items)
    .map<Command>((item) => ({
      id: `nav:${item.to}`,
      label: item.label,
      hint: 'Перейти',
      run: (ctx) => ctx.navigate(item.to),
    }))

  return [
    ...nav,
    { id: 'action:new-task', label: 'Новая задача', hint: 'Создать', run: (ctx) => ctx.newTask() },
    { id: 'action:toggle-theme', label: 'Сменить тему', hint: 'Оформление', run: (ctx) => ctx.toggleTheme() },
  ]
}

export function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter((c) => c.label.toLowerCase().includes(q))
}
