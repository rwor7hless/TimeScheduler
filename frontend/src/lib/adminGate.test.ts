import { describe, it, expect } from 'vitest'
import { adminGate } from './adminGate'

describe('adminGate', () => {
  it('sends an unauthenticated visitor to login', () => {
    expect(adminGate({ isAuthenticated: false, user: null })).toBe('login')
  })

  // The regression: a reload on /admin rendered the guard before /auth/me
  // answered, read isAdmin as false and bounced the admin to the calendar.
  it('waits while the token is present but /auth/me has not answered yet', () => {
    expect(adminGate({ isAuthenticated: true, user: null })).toBe('pending')
  })

  it('lets an admin through', () => {
    expect(adminGate({ isAuthenticated: true, user: { is_admin: true } })).toBe('allow')
  })

  it('turns away a regular user once their profile is known', () => {
    expect(adminGate({ isAuthenticated: true, user: { is_admin: false } })).toBe('deny')
  })
})
