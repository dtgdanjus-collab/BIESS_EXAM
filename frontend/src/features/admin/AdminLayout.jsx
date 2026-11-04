import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { postulacionApi } from '../../api/postulacion'
import { Button, ErrorAlert, Icon, Input } from '../../components/ui'
import { InstalarApp } from '../../components/layout/InstalarApp'
import { Marca } from '../../components/layout/Layouts'
import { useAsync } from '../../hooks/useAsync'
import { useBloqueo } from '../../hooks/useBloqueo'
import { useTituloPagina } from '../../hooks/useTituloPagina'
import { useAdminStore } from '../../store/adminStore'
import { aplicarErroresCampos } from '../../utils/formErrors'
import { BloqueoAviso, claseEnlace as claseEnlaceAcceso, PasswordInput } from '../auth/components'
import { SelloCerradura } from './SelloCerradura'

/** El estado real del concurso, tal como lo ve un postulante. */
function useConcursoPublico() {
  const [datos, setDatos] = useState(null)
  useEffect(() => {
    let vigente = true
    postulacionApi.concursoPublico().then((d) => vigente && setDatos(d)).catch(() => {})
    return () => {
      vigente = false
    }
  }, [])
  return datos
}

export function AdminLoginPage() {
  useTituloPagina('Administración')
  const autenticado = useAdminStore((s) => s.isAuthenticated())
  const guardar = useAdminStore((s) => s.login)
  const navigate = useNavigate()
  const peticion = useAsync()
  const bloqueo = useBloqueo()
  const concurso = useConcursoPublico()
  const [autorizado, setAutorizado] = useState(false)
  // El aviso rojo del sello dura hasta que se corrige lo que se intentó.
  const [intento, setIntento] = useState(null)
  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm({ defaultValues: { usuario: '', password: '' } })
  const usuario = watch('usuario')
  const clave = watch('password')

  if (autenticado) return <Navigate to="/admin" replace />

  const firma = `${usuario}|${clave.length}`
  const estadoSello = autorizado
    ? 'autorizado'
    : bloqueo.bloqueado
      ? 'bloqueado'
      : peticion.loading
        ? 'verificando'
        : peticion.error && intento === firma
          ? 'error'
          : usuario && clave
            ? 'listo'
            : usuario
              ? 'usuario'
              : 'vacio'

  const onSubmit = handleSubmit(async (v) => {
    setIntento(`${v.usuario}|${v.password.length}`)
    const r = await peticion.run(() => adminApi.login(v))
    if (r.ok) {
      // Un instante para ver caer el sello antes de entrar.
      setAutorizado(true)
      bloqueo.limpiar()
      setTimeout(() => {
        guardar(r.data)
        navigate('/admin', { replace: true })
      }, 700)
      return
    }
    bloqueo.procesarError(r.error)
    aplicarErroresCampos(r.error, setError)
  })

  return (
    <div className="min-h-dvh bg-papel lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="relative overflow-hidden bg-noche text-white [&_a:focus-visible]:outline-white md:min-h-[26rem] lg:sticky lg:top-0 lg:h-dvh">
        {/* El disco del acceso de postulantes con los colores invertidos. */}
        <div aria-hidden="true" className="absolute -right-[10vw] -top-[15vw] aspect-square w-[30vw] rounded-full bg-sello md:-right-[9rem] md:top-[3rem] md:w-[40rem] lg:-right-[48vh] lg:top-[42vh] lg:w-[150vh]" />

        <div className="relative px-4 pt-3 lg:px-10 lg:pt-10 xl:px-14 xl:pt-12">
          <Marca claro />
        </div>

        <div className="relative px-4 pb-5 pt-3 md:max-w-[52%] md:px-6 md:pb-8 md:pt-8 lg:max-w-none lg:px-10 lg:pb-0 lg:pt-[7vh] xl:px-14">
          <h2 className="max-w-[13em] animate-aparece text-[1.75rem] font-medium leading-[1.03] tracking-[-0.03em] md:text-[1.9rem] lg:text-[clamp(2.25rem,3.6vw,3.75rem)]">
            Seis fases, tres sectores, un Directorio
          </h2>
          <p className="mt-3 max-w-[26rem] animate-aparece text-base leading-relaxed [animation-delay:70ms] lg:mt-5">
            Talento Humano y la Comisión de Selección conducen aquí el concurso de afiliados, jubilados y empleadores.
          </p>
          {concurso && (
            <p className="mt-4 flex animate-aparece items-center gap-2.5 text-base font-medium [animation-delay:140ms]">
              <span className={`size-3 shrink-0 rounded-full ${concurso.formularioAbierto ? 'bg-sello-claro' : 'bg-noche-tenue'}`} />
              Formulario de postulación {concurso.formularioAbierto ? 'abierto' : 'cerrado'}
            </p>
          )}
        </div>

        <div aria-hidden="true" className="absolute bottom-6 right-6 hidden w-80 md:block lg:bottom-[4vh] lg:right-[5%] lg:w-[min(46vh,34vw)]">
          <SelloCerradura usuario={usuario} largoClave={clave.length} estado={estadoSello} />
        </div>
      </aside>
      <div className="flex flex-col lg:min-h-dvh">
        <main className="flex flex-1 items-start justify-center px-4 py-6 sm:px-6 lg:items-center lg:py-12">
          <form onSubmit={onSubmit} noValidate className="w-full max-w-md">
            <h1 className="animate-aparece text-[32px] font-medium leading-[1.05] tracking-[-0.03em] lg:text-[44px]">Módulo de administración</h1>
            <p className="mt-3 animate-aparece text-base leading-relaxed text-tenue [animation-delay:70ms]">Ingrese con el usuario y la contraseña de su cuenta.</p>
            <div className="mt-7 animate-aparece space-y-4 [animation-delay:140ms]">
              {peticion.error?.status !== 423 && <ErrorAlert error={peticion.error} />}
              <BloqueoAviso bloqueo={bloqueo} mensajeBloqueo={peticion.error?.message} />
              <fieldset disabled={bloqueo.bloqueado} className="space-y-4">
                <Input label="Usuario" icono="user" autoComplete="username" autoCapitalize="none" spellCheck={false} required error={errors.usuario?.message} {...register('usuario')} />
                <PasswordInput label="Contraseña" autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
              </fieldset>
              <Button type="submit" className="w-full" loading={peticion.loading} disabled={bloqueo.bloqueado}>
                {bloqueo.bloqueado ? `Bloqueado (${bloqueo.tiempo})` : 'Ingresar'}
              </Button>
              <InstalarApp />
            </div>
            <p className="mt-6 text-sm text-tenue">
              ¿Es postulante?{' '}
              <Link to="/login" className={claseEnlaceAcceso}>
                Ingrese con su cédula
              </Link>
            </p>
          </form>
        </main>
        <footer className="px-4 pb-5 text-[13px] text-tenue sm:px-6 lg:text-center">
          <p className="mx-auto max-w-md lg:max-w-none">
            Sistema académico de demostración · Requerimiento Funcional IESS v1.4 · Resolución C.D. 701 ·{' '}
            <Link to="/privacidad" className="underline underline-offset-2">Política de privacidad</Link>
          </p>
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
          <NavLink to="/admin/elegibles" className={claseEnlace}>Elegibles</NavLink>
          {esAdministrador && <NavLink to="/admin/fases" className={claseEnlace}>Fases</NavLink>}
          {esAdministrador && <NavLink to="/admin/puntajes" className={claseEnlace}>Puntajes</NavLink>}
          {esAdministrador && <NavLink to="/admin/evaluacion" className={claseEnlace}>Banco de preguntas</NavLink>}
          {esAdministrador && <NavLink to="/admin/usuarios" className={claseEnlace}>Usuarios</NavLink>}
          {esAdministrador && <NavLink to="/admin/bitacora" className={claseEnlace}>Bitácora</NavLink>}
        </nav>
      </header>
      <main className="mx-auto max-w-[84rem] px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
