import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api'

export interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  roles: string[]
  permissions: string[]
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored && localStorage.getItem('api_token')) {
      try {
        const parsed = JSON.parse(stored)
        setUser({
          ...parsed,
          roles: Array.isArray(parsed?.roles) ? parsed.roles : [],
          permissions: Array.isArray(parsed?.permissions) ? parsed.permissions : [],
        })
      } catch {
        localStorage.removeItem('user')
      }
      // Refresh roles/permissions from the server so the UI never relies on stale data
      api.get('/auth/me')
        .then((r) => {
          const fresh = r.data?.data
          if (fresh?.id) {
            localStorage.setItem('user', JSON.stringify(fresh))
            setUser({ ...fresh, roles: fresh.roles ?? [], permissions: fresh.permissions ?? [] })
          }
        })
        .catch(() => {})
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const resp = await api.post('/auth/login', { email, password })
    const { data } = resp.data
    localStorage.setItem('api_token', data.api_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore network errors on logout
    }
    localStorage.removeItem('api_token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false
      if (user.roles.includes('super_admin')) return true
      return user.permissions.includes(permission)
    },
    [user]
  )

  const hasRole = useCallback(
    (role: string) => (user ? user.roles.includes(role) : false),
    [user]
  )

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}