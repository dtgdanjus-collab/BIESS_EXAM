import { createContext, use, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Icon } from '../ui'
import { CedulaEnVivo, LecturaCedula } from './LecturaCedula'
import { MenuPerfil } from './MenuPerfil'

/** Monograma del producto: el sello de recepción reducido a su letra. */
export function Monograma() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
      <circle cx="16" cy="16" r="14" fill="white" stroke="#1d5fbf" strokeWidth="2.5" />
      <path d="M12 9h5.2a3.6 3.6 0 0 1 1.9 6.7A3.9 3.9 0 0 1 17.6 23H12z" fill="none" stroke="#1d5fbf" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M12 15.8h6" stroke="#1d5fbf" strokeWidth="2.4" />
    </svg>
  )
}

export function Marca({ claro = false, compacta = false }) {
  return (
    <Link to="/" className="inline-flex min-h-11 items-center gap-2.5">
      <Monograma />
      <span className="leading-tight">
        <span className={`block text-sm font-medium ${claro ? 'text-white' : 'text-tinta'}`}>Directorio BIESS</span>
        {!compacta && (
          <span className={`block text-[13px] ${claro ? 'text-noche-tenue' : 'text-tenue'}`}>Concurso de Méritos y Oposición</span>
        )}
      </span>
    </Link>
  )
}

/** Pantallas públicas: registro, login y recuperación. */
export function AuthLayout() {
  const [cedula, setCedula] = useState('')
  return (
    <CedulaEnVivo value={setCedula}>
      <div className="min-h-dvh bg-papel lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <LecturaCedula cedula={cedula} marca={<Marca claro />} />
        <div className="flex flex-col lg:min-h-dvh">
          <main className="flex flex-1 items-start justify-center px-4 py-6 sm:px-6 lg:items-center lg:py-12">
            <div className="w-full max-w-md">
              <Outlet />
            </div>
          </main>
          <footer className="px-4 pb-5 text-[13px] text-tenue sm:px-6 lg:text-center">
            <p className="mx-auto max-w-md lg:max-w-none">
              Sistema académico de demostración · Requerimiento Funcional IESS v1.4 · Resolución C.D. 701
            </p>
          </footer>
        </div>
      </div>
    </CedulaEnVivo>
  )
}

const Ranuras = createContext({ barra: null, cabecera: null })

/** Coloca su contenido en la barra lateral del área privada. */
export function EnBarra({ children }) {
  const { barra } = use(Ranuras)
  return barra ? createPortal(children, barra) : null
}

/** Coloca su contenido en la cabecera negra, a todo el ancho sobre el contenido. */
export function EnCabecera({ children }) {
  const { cabecera } = use(Ranuras)
  return cabecera ? createPortal(children, cabecera) : null
}

/** Área privada: barra y cabecera negras, como el panel del acceso; en el teléfono la barra se pliega. */
export function AppLayout() {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [barra, setBarra] = useState(null)
  const [cabecera, setCabecera] = useState(null)

  const salir = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Ranuras value={{ barra, cabecera }}>
      <a
        href="#contenido"
        className="no-print sr-only rounded-md bg-white px-4 py-3 text-sm font-medium text-tinta focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50"
      >
        Saltar al contenido
      </a>
      {/* Al imprimir la barra no existe: sin print:block su columna vacía aplastaría el documento. */}
      <div className="min-h-dvh lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] print:block">
        <aside className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 bg-noche px-4 text-white [&_:focus-visible]:outline-white lg:h-dvh lg:flex-col lg:items-stretch lg:p-3">
          <div className="lg:px-2 lg:pt-3">
            <Marca claro compacta />
          </div>
          <div ref={setBarra} className="hidden min-h-0 flex-1 overflow-y-auto lg:mt-6 lg:block" />
          <div className="flex min-w-0 items-center gap-1 lg:justify-between">
            <MenuPerfil />
            <button
              type="button"
              onClick={salir}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-noche-tenue transition-colors hover:bg-white/10 hover:text-white pointer-fine:lg:size-9"
            >
              <Icon name="logout" className="size-4" />
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <div ref={setCabecera} className="no-print" />
          <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[76rem]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </Ranuras>
  )
}
