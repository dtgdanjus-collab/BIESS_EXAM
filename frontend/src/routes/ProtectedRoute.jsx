import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

// Solo deja pasar con sesión válida; si no, redirige a /login recordando a dónde iba.
export function ProtectedRoute() {
  const autenticado = useAuthStore((s) => s.isAuthenticated())
  const location = useLocation()
  if (!autenticado) {
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  }
  return <Outlet />
}

// Login y registro no tienen sentido con sesión iniciada.
export function PublicOnlyRoute() {
  const autenticado = useAuthStore((s) => s.isAuthenticated())
  return autenticado ? <Navigate to="/formulario" replace /> : <Outlet />
}
