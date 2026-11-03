import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout, AuthLayout } from '../components/layout/Layouts'
import { PageLoader } from '../components/ui'
import { LoginPage } from '../features/auth/LoginPage'
import { RecuperarPage } from '../features/auth/RecuperarPage'
import { RegistroPage } from '../features/auth/RegistroPage'
import { RestablecerPage } from '../features/auth/RestablecerPage'
import { useTituloPagina } from '../hooks/useTituloPagina'
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'

// El formulario (la parte más pesada) se descarga solo cuando hay sesión.
const FormularioPage = lazy(() =>
  import('../features/postulacion/FormularioPage').then((m) => ({ default: m.FormularioPage })),
)

function NoEncontrada() {
  useTituloPagina('Página no encontrada')
  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 sm:px-16">
      <h1 className="text-2xl font-medium tracking-tight">Esta página no existe</h1>
      <p className="mt-2 text-sm text-tenue">Error 404. Verifique la dirección o vuelva al inicio para continuar.</p>
      <Link to="/" className="mt-6 inline-flex min-h-11 w-fit items-center rounded-md bg-tinta px-4 text-sm font-medium text-white transition-colors hover:bg-[#2b2b2b]">
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
