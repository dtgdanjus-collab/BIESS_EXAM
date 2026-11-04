import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { Button, ErrorAlert, Icon, Input } from '../../components/ui'
import { Marca } from '../../components/layout/Layouts'
import { useAsync } from '../../hooks/useAsync'
import { useBloqueo } from '../../hooks/useBloqueo'
import { useTituloPagina } from '../../hooks/useTituloPagina'
import { useAdminStore } from '../../store/adminStore'
import { aplicarErroresCampos } from '../../utils/formErrors'
import { BloqueoAviso } from '../auth/components'

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
    <div className="flex min-h-dvh items-center justify-center bg-noche px-4 py-8">
      <form onSubmit={onSubmit} noValidate className="w-full max-w-sm rounded-lg bg-papel p-6">
        <h1 className="text-xl font-medium tracking-tight">Módulo de administración</h1>
        <p className="mt-1 text-sm text-tenue">Talento Humano y Comisión de Selección</p>
        <div className="mt-6 space-y-4">
          {peticion.error?.status !== 423 && <ErrorAlert error={peticion.error} />}
          <BloqueoAviso bloqueo={bloqueo} mensajeBloqueo={peticion.error?.message} />
          <fieldset disabled={bloqueo.bloqueado} className="space-y-4">
            <Input label="Usuario" autoComplete="username" required error={errors.usuario?.message} {...register('usuario')} />
            <Input label="Contraseña" type="password" autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
          </fieldset>
          <Button type="submit" className="w-full" loading={peticion.loading} disabled={bloqueo.bloqueado}>
            {bloqueo.bloqueado ? `Bloqueado (${bloqueo.tiempo})` : 'Ingresar'}
          </Button>
        </div>
      </form>
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
