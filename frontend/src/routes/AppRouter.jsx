import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout, AuthLayout } from '../components/layout/Layouts'
import { PageLoader } from '../components/ui'
import { LoginPage } from '../features/auth/LoginPage'
import { PrivacidadPage } from '../features/auth/PrivacidadPage'
import { RecuperarPage } from '../features/auth/RecuperarPage'
import { RegistroPage } from '../features/auth/RegistroPage'
import { RestablecerPage } from '../features/auth/RestablecerPage'
import { useTituloPagina } from '../hooks/useTituloPagina'
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'

// El formulario (la parte más pesada) se descarga solo cuando hay sesión.
const FormularioPage = lazy(() =>
  import('../features/postulacion/FormularioPage').then((m) => ({ default: m.FormularioPage })),
)
const de = (carga, nombre) => lazy(() => carga().then((m) => ({ default: m[nombre] })))
const concurso = () => import('../features/concurso/MiConcursoPage')
const componentes = () => import('../features/concurso/componentes')
const examen = () => import('../features/concurso/EvaluacionPage')
const marco = () => import('../features/admin/AdminLayout')
const nomina = () => import('../features/admin/AdminPostulantes')
const gestion = () => import('../features/admin/AdminConcurso')
const reportes = () => import('../features/admin/AdminReportes')
const MiConcursoPage = de(concurso, 'MiConcursoPage')
const FasesPage = de(componentes, 'FasesPage')
const EvaluacionPage = de(examen, 'EvaluacionPage')
const AdminLoginPage = de(marco, 'AdminLoginPage')
const AdminLayout = de(marco, 'AdminLayout')
const PanelPage = de(nomina, 'PanelPage')
const PostulantesPage = de(nomina, 'PostulantesPage')
const PostulanteDetallePage = de(nomina, 'PostulanteDetallePage')
const FasesAdminPage = de(gestion, 'FasesAdminPage')
const EvaluacionAdminPage = de(gestion, 'EvaluacionAdminPage')
const ResultadosPage = de(gestion, 'ResultadosPage')
const ReconsideracionesPage = de(gestion, 'ReconsideracionesPage')
const UsuariosPage = de(gestion, 'UsuariosPage')
const ElegiblesPage = de(reportes, 'ElegiblesPage')
const PuntajesPage = de(reportes, 'PuntajesPage')
const BitacoraPage = de(reportes, 'BitacoraPage')

const conCarga = (elemento) => <Suspense fallback={<PageLoader />}>{elemento}</Suspense>

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
        <Route path="/fases" element={conCarga(<FasesPage />)} />
        <Route path="/privacidad" element={<PrivacidadPage />} />
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
          <Route path="/concurso" element={conCarga(<MiConcursoPage />)} />
        </Route>
        <Route path="/evaluacion" element={conCarga(<EvaluacionPage />)} />
      </Route>

      <Route path="/admin/login" element={conCarga(<AdminLoginPage />)} />
      <Route path="/admin" element={conCarga(<AdminLayout />)}>
        <Route index element={conCarga(<PanelPage />)} />
        <Route path="postulantes" element={conCarga(<PostulantesPage />)} />
        <Route path="postulantes/:id" element={conCarga(<PostulanteDetallePage />)} />
        <Route path="fases" element={conCarga(<FasesAdminPage />)} />
        <Route path="evaluacion" element={conCarga(<EvaluacionAdminPage />)} />
        <Route path="resultados" element={conCarga(<ResultadosPage />)} />
        <Route path="reconsideraciones" element={conCarga(<ReconsideracionesPage />)} />
        <Route path="usuarios" element={conCarga(<UsuariosPage />)} />
        <Route path="elegibles" element={conCarga(<ElegiblesPage />)} />
        <Route path="puntajes" element={conCarga(<PuntajesPage />)} />
        <Route path="bitacora" element={conCarga(<BitacoraPage />)} />
      </Route>

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
