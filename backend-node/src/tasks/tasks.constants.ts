/**
 * Task color palette. Mirrors `TASK_COLOR_PALETTE` in
 * `backend/app/models/task.py` (lines 48-59) byte-for-byte. Used when
 * `TaskCreate.color` is omitted — `create` picks a random entry.
 *
 * Do NOT reorder; the frontend keeps an identical list at
 * `frontend/src/types/task.ts` and picks from it for localStorage fallbacks.
 */
export const TASK_COLOR_PALETTE: readonly string[] = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
] as const;

export function pickRandomTaskColor(): string {
  const idx = Math.floor(Math.random() * TASK_COLOR_PALETTE.length);
  return TASK_COLOR_PALETTE[idx];
}

/**
 * Escape a user-supplied search string for use inside a `LIKE`/`ILIKE`
 * pattern. Matches Python's `tasks.py` line 93:
 *   search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
 *
 * Order matters: backslash first so we don't double-escape the escapes we
 * just introduced.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
