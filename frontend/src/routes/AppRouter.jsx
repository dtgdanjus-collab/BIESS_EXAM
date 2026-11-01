import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout, AuthLayout } from '../components/layout/Layouts'
import { Icon, PageLoader } from '../components/ui'
import { LoginPage } from '../features/auth/LoginPage'
import { RecuperarPage } from '../features/auth/RecuperarPage'
import { RegistroPage } from '../features/auth/RegistroPage'
import { RestablecerPage } from '../features/auth/RestablecerPage'
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'

// El formulario (la parte más pesada) se descarga solo cuando hay sesión.
const FormularioPage = lazy(() =>
  import('../features/postulacion/FormularioPage').then((m) => ({ default: m.FormularioPage })),
)

function NoEncontrada() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center animate-fade-up">
      <p className="bg-gradient-to-br from-brand-600 to-gold-400 bg-clip-text text-8xl font-extrabold tracking-tighter text-transparent">
        404
      </p>
      <p className="mt-3 text-lg font-bold text-slate-800">Esta página no existe</p>
      <p className="mt-1 text-sm text-slate-500">Verifique la dirección o vuelva al inicio para continuar.</p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-colors hover:bg-brand-800"
      >
        <Icon name="home" className="size-4" />
        Volver al inicio
      </Link>
    </div>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/formulario" replace />} />

      <Route element={<AuthLayout />}>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
        </Route>
        <Route path="/recuperar" element={<RecuperarPage />} />
        <Route path="/restablecer" element={<RestablecerPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/formulario"
            element={
              <Suspense fallback={<PageLoader />}>
                <FormularioPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
