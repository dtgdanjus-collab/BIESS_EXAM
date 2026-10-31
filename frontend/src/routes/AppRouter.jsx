import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout, AuthLayout } from '../components/layout/Layouts'
import { LoginPage } from '../features/auth/LoginPage'
import { RecuperarPage } from '../features/auth/RecuperarPage'
import { RegistroPage } from '../features/auth/RegistroPage'
import { RestablecerPage } from '../features/auth/RestablecerPage'
import { FormularioPage } from '../features/postulacion/FormularioPage'
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'

function NoEncontrada() {
  return (
    <div className="py-16 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="mt-2 text-slate-600">La página solicitada no existe.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
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
          <Route path="/formulario" element={<FormularioPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
