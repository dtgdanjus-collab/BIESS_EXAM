import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { Button, ErrorAlert, Icon, Input } from '../../components/ui'
import { Marca } from '../../components/layout/Layouts'
import { useAsync } from '../../hooks/useAsync'
import { useBloqueo } from '../../hooks/useBloqueo'
import { useTituloPagina } from '../../hooks/useTituloPagina'
import { useAdminStore } from '../../store/adminStore'
import { aplicarErroresCampos } from '../../utils/formErrors'
import { BloqueoAviso, claseEnlace as claseEnlaceAcceso, PasswordInput } from '../auth/components'

const TAREAS = [
  ['Talento Humano', 'Revisa los expedientes, registra las calificaciones y responde las reconsideraciones.'],
  ['Comisión de Selección', 'Además publica las fases, habilita el formulario y gestiona el banco de preguntas.'],
]

export function AdminLoginPage() {
  useTituloPagina('Administración')
  const autenticado = useAdminStore((s) => s.isAuthenticated())
  const guardar = useAdminStore((s) => s.login)
  const navigate = useNavigate()
  const peticion = useAsync()
  const bloqueo = useBloqueo()
  const { register, handleSubmit, setError, formState: { errors } } = useForm({ defaultValues: { usuario: '', password: '' } })

  if (autenticado) return <Navigate to="/admin" replace />

  const onSubmit = handleSubmit(async (v) => {
    const r = await peticion.run(() => adminApi.login(v))
    if (r.ok) {
      guardar(r.data)
      navigate('/admin', { replace: true })
      return
    }
    bloqueo.procesarError(r.error)
    aplicarErroresCampos(r.error, setError)
  })

  return (
    <div className="min-h-dvh bg-papel lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="flex flex-col bg-noche px-4 py-5 text-white [&_:focus-visible]:outline-white sm:px-6 lg:min-h-dvh lg:px-14 lg:py-12">
        <Marca claro />
        <div className="mt-6 lg:my-auto">
          <h2 className="text-2xl font-medium leading-tight tracking-tight lg:text-[32px]">El concurso, de la postulación a la lista de elegibles</h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-noche-tenue">
            Espacio de trabajo de la Subdirección de Talento Humano y de la Comisión de Selección.
          </p>
          <dl className="mt-10 hidden max-w-lg border-t border-white/15 lg:block">
            {TAREAS.map(([rol, tarea]) => (
              <div key={rol} className="border-b border-white/15 py-4">
                <dt className="text-sm font-medium">{rol}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-noche-tenue">{tarea}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
      <div className="flex flex-col lg:min-h-dvh">
        <main className="flex flex-1 items-start justify-center px-4 py-6 sm:px-6 lg:items-center lg:py-12">
          <form onSubmit={onSubmit} noValidate className="w-full max-w-md">
            <h1 className="text-2xl font-medium tracking-tight lg:text-[32px] lg:leading-tight">Módulo de administración</h1>
            <p className="mt-2 text-sm leading-relaxed text-tenue">Ingrese con el usuario y la contraseña de su cuenta institucional.</p>
            <div className="mt-6 space-y-4">
              {peticion.error?.status !== 423 && <ErrorAlert error={peticion.error} />}
              <BloqueoAviso bloqueo={bloqueo} mensajeBloqueo={peticion.error?.message} />
              <fieldset disabled={bloqueo.bloqueado} className="space-y-4">
                <Input label="Usuario" icono="user" autoComplete="username" autoCapitalize="none" spellCheck={false} required error={errors.usuario?.message} {...register('usuario')} />
                <PasswordInput label="Contraseña" autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
              </fieldset>
              <Button type="submit" className="w-full" loading={peticion.loading} disabled={bloqueo.bloqueado}>
                {bloqueo.bloqueado ? `Bloqueado (${bloqueo.tiempo})` : 'Ingresar'}
              </Button>
            </div>
            <p className="mt-6 text-sm text-tenue">
              ¿Es postulante?{' '}
              <Link to="/login" className={claseEnlaceAcceso}>
                Ingrese con su cédula
              </Link>
            </p>
          </form>
        </main>
        <footer className="px-4 pb-5 text-xs text-tenue sm:px-6 lg:text-center">
          <p className="mx-auto max-w-md lg:max-w-none">Sistema académico de demostración · Requerimiento Funcional IESS v1.4 · Resolución C.D. 701</p>
        </footer>
      </div>
    </div>
  )
}

const claseEnlace = ({ isActive }) =>
  `flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm transition-colors ${isActive ? 'bg-white font-medium text-tinta' : 'text-noche-tenue hover:bg-white/10 hover:text-white'}`

/** Marco del módulo: el rol decide qué apartados se muestran (el backend también lo exige). */
export function AdminLayout() {
  const autenticado = useAdminStore((s) => s.isAuthenticated())
  const admin = useAdminStore((s) => s.admin)
  const logout = useAdminStore((s) => s.logout)
  const [, forzar] = useState(0)

  if (!autenticado) return <Navigate to="/admin/login" replace />
  const esAdministrador = admin?.rol === 'ADMINISTRADOR'
  const salir = () => {
    logout()
    forzar((n) => n + 1)
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="no-print bg-noche px-4 text-white [&_:focus-visible]:outline-white sm:px-6">
        <div className="mx-auto flex max-w-[84rem] flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2">
          <Marca claro compacta />
          <div className="flex items-center gap-2">
            <p className="text-right text-xs">
              <span className="block text-white">{admin?.nombre}</span>
              <span className="text-noche-tenue">{esAdministrador ? 'Administrador' : 'Analista'}</span>
            </p>
            <button type="button" onClick={salir} aria-label="Cerrar sesión" title="Cerrar sesión" className="flex size-11 items-center justify-center rounded-md text-noche-tenue hover:bg-white/10 hover:text-white">
              <Icon name="logout" className="size-4" />
            </button>
          </div>
        </div>
        <nav aria-label="Administración" className="mx-auto flex max-w-[84rem] gap-1 overflow-x-auto pb-2">
          <NavLink end to="/admin" className={claseEnlace}>Panel</NavLink>
          <NavLink to="/admin/postulantes" className={claseEnlace}>Postulantes</NavLink>
          <NavLink to="/admin/reconsideraciones" className={claseEnlace}>Reconsideraciones</NavLink>
          <NavLink to="/admin/resultados" className={claseEnlace}>Resultados</NavLink>
          {esAdministrador && <NavLink to="/admin/fases" className={claseEnlace}>Fases</NavLink>}
          {esAdministrador && <NavLink to="/admin/evaluacion" className={claseEnlace}>Banco de preguntas</NavLink>}
          {esAdministrador && <NavLink to="/admin/usuarios" className={claseEnlace}>Usuarios</NavLink>}
        </nav>
      </header>
      <main className="mx-auto max-w-[84rem] px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
