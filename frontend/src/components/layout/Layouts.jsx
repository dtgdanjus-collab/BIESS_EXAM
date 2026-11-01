import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Icon } from '../ui'

export function Marca({ claro = false, compacta = false }) {
  return (
    <Link to="/" className="group flex items-center gap-3">
      <span className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-900 text-gold-300 shadow-glow ring-1 ring-white/20 transition-transform group-hover:scale-105">
        <Icon name="check" className="size-5" strokeWidth={3} />
      </span>
      <span className="leading-tight">
        <span className={`block text-[15px] font-extrabold tracking-tight ${claro ? 'text-white' : 'text-slate-900'}`}>
          Directorio <span className={claro ? 'text-gold-300' : 'text-brand-700'}>BIESS</span>
        </span>
        {!compacta && (
          <span className={`block text-xs font-medium ${claro ? 'text-brand-100/70' : 'text-slate-500'}`}>
            Concurso Público de Méritos y Oposición
          </span>
        )}
      </span>
    </Link>
  )
}

const PASOS = [
  { icono: 'fingerprint', titulo: 'Valide su identidad', texto: 'Con su cédula y la fecha de expedición o el código dactilar.' },
  { icono: 'file', titulo: 'Complete su postulación', texto: 'Diez secciones guiadas; puede guardar su avance cuando quiera.' },
  { icono: 'send', titulo: 'Envíe y reciba su código', texto: 'Obtenga un comprobante con su código único de postulación.' },
]

/** Panel institucional de las pantallas públicas (solo escritorio). */
function PanelInstitucional() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-950 text-white lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-16">
      {/* Fondo: gradientes en movimiento lento + trama de puntos */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-brand-600/50 blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 right-[-6rem] size-[30rem] rounded-full bg-gold-500/25 blur-3xl animate-float"
          style={{ animationDelay: '-4s' }}
        />
        <div className="absolute inset-0 bg-dots opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-brand-950/80" />
      </div>

      <div className="relative">
        <Marca claro />
      </div>

      <div className="relative max-w-lg animate-fade-up">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-200 ring-1 ring-inset ring-white/15 backdrop-blur">
          <Icon name="sparkles" className="size-3.5" />
          Convocatoria 2026 · Resolución C.D. 701
        </span>
        <h2 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">
          Postúlese al{' '}
          <span className="bg-gradient-to-r from-gold-200 via-gold-300 to-gold-400 bg-clip-text text-transparent">
            Directorio del BIESS
          </span>
        </h2>
        <p className="mt-4 text-base leading-relaxed text-brand-100/80">
          Un proceso transparente y 100&nbsp;% en línea para representar a afiliados, jubilados y empleadores.
        </p>

        <ol className="mt-10 space-y-5">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-4">
              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gold-300 ring-1 ring-inset ring-white/15">
                <Icon name={p.icono} className="size-5" />
                <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-gold-400 text-[10px] font-extrabold text-brand-950">
                  {i + 1}
                </span>
              </span>
              <div>
                <p className="font-semibold">{p.titulo}</p>
                <p className="text-sm text-brand-100/70">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="relative flex flex-wrap gap-x-6 gap-y-2 text-xs text-brand-100/60">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="shield" className="size-4 text-gold-300/80" />
          Datos protegidos (LOPDP)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="id" className="size-4 text-gold-300/80" />
          Validación con el Registro Civil
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="lock" className="size-4 text-gold-300/80" />
          Conexión segura
        </span>
      </div>
    </aside>
  )
}

/** Pantallas públicas: registro, login y recuperación. */
export function AuthLayout() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <PanelInstitucional />
      <div className="flex min-h-dvh flex-col">
        {/* Encabezado solo en móvil y tablet */}
        <header className="relative overflow-hidden bg-brand-950 px-5 pb-16 pt-5 text-white lg:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-40" />
          <div aria-hidden="true" className="absolute -right-20 -top-24 size-72 rounded-full bg-gold-500/25 blur-3xl" />
          <div className="relative">
            <Marca claro />
          </div>
        </header>
        <main className="-mt-10 flex flex-1 items-start justify-center px-4 pb-10 sm:px-6 lg:mt-0 lg:items-center lg:py-12">
          <div className="w-full max-w-md animate-fade-up">
            <Outlet />
          </div>
        </main>
        <footer className="px-4 pb-6 text-center text-xs text-slate-400">
          Sistema académico de demostración · Requerimiento Funcional IESS v1.4
        </footer>
      </div>
    </div>
  )
}

const iniciales = (u) =>
  `${u?.nombres?.[0] ?? ''}${u?.apellidos?.[0] ?? ''}`.toUpperCase() || 'U'

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
      <header className="no-print sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Marca compacta />
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <div className="flex min-w-0 items-center gap-3 rounded-full py-1 pl-1 pr-1 sm:pr-4 sm:ring-1 sm:ring-slate-200/80">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-sm font-extrabold text-brand-950 ring-2 ring-white">
                {iniciales(usuario)}
              </span>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold leading-tight text-slate-800">
                  {usuario?.nombres} {usuario?.apellidos}
                </p>
                <p className="text-xs text-slate-500">C.I. {usuario?.cedula}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={salir}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon name="logout" className="size-[18px]" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="no-print px-4 pb-6 pt-2 text-center text-xs text-slate-400">
        Directorio BIESS · Concurso Público de Méritos y Oposición
      </footer>
    </div>
  )
}
