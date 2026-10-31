import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../ui'

function Marca({ compacta = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-700 text-white" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-slate-900">Directorio BIESS</span>
        {!compacta && <span className="block text-xs text-slate-500">Concurso Público de Méritos y Oposición</span>}
      </span>
    </Link>
  )
}

/** Pantallas públicas: registro, login y recuperación. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3">
          <Marca />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
      <footer className="px-4 py-4 text-center text-xs text-slate-500">
        Sistema académico de demostración · Resolución C.D. 701
      </footer>
    </div>
  )
}

/** Área privada: barra superior con el usuario y cierre de sesión. */
export function AppLayout() {
  const usuario = useAuthStore((s) => s.usuario)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const salir = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Marca compacta />
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium text-slate-800">
                {usuario?.nombres} {usuario?.apellidos}
              </p>
              <p className="text-xs text-slate-500">C.I. {usuario?.cedula}</p>
            </div>
            <Button variant="secondary" onClick={salir}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
