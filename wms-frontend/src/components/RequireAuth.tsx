import { useAuth } from '../context/AuthContext'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F1F4F6',
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid #DCE3E8',
          borderTopColor: '#0F766E',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

/** Blocks a page when the user lacks the permission (any of them, when an array). */
export function RequirePermission({ permission, children }: { permission: string | string[]; children: ReactNode }) {
  const { hasPermission } = useAuth()
  const ok = Array.isArray(permission) ? permission.some(hasPermission) : hasPermission(permission)
  if (ok) return <>{children}</>
  return (
    <div className="max-w-md mx-auto mt-20 text-center bg-surface border border-border rounded-xl p-8 shadow-panel">
      <div className="w-12 h-12 mx-auto rounded-xl bg-amber-soft text-amber flex items-center justify-center mb-3"><ShieldAlert size={22} /></div>
      <h1 className="text-lg font-bold text-ink">Access restricted</h1>
      <p className="text-sm text-ink-muted mt-1">Your role does not include access to this area. Ask an administrator if you need it.</p>
      <Link to="/dashboard" className="inline-block mt-4 text-sm font-semibold text-brand hover:underline">Back to dashboard</Link>
    </div>
  )
}
