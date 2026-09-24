/**
 * Решение охранника /admin.
 *
 * Токен в localStorage известен сразу, а профиль (и is_admin в нём) — только
 * после ответа /auth/me. Пока профиля нет, ответа «нет» не существует: при
 * перезагрузке на /admin охранник раньше читал isAdmin как false и выкидывал
 * админа в календарь.
 */
export type AdminGate = 'login' | 'pending' | 'deny' | 'allow'

export function adminGate({
  isAuthenticated,
  user,
}: {
  isAuthenticated: boolean
  user: { is_admin: boolean } | null
}): AdminGate {
  if (!isAuthenticated) return 'login'
  if (!user) return 'pending'
  return user.is_admin ? 'allow' : 'deny'
}
