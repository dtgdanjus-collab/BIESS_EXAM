import { useEffect, useRef, useState } from 'react'
import { ASIGNATURA, EVALUACION, INTEGRANTES } from '../../config/integrantes'
import { useAuthStore } from '../../store/authStore'
import { Icon } from '../ui'

const inicialesDe = (texto = '') =>
  texto
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

/** Ficha del usuario en el encabezado: al pulsarla despliega su perfil y los integrantes del grupo. */
export function MenuPerfil() {
  const usuario = useAuthStore((s) => s.usuario)
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)
  const boton = useRef(null)

  // Se cierra al hacer clic fuera o con Escape (devolviendo el foco a la ficha).
  useEffect(() => {
    if (!abierto) return undefined
    const fuera = (e) => {
      if (!contenedor.current?.contains(e.target)) setAbierto(false)
    }
    const tecla = (e) => {
      if (e.key === 'Escape') {
        setAbierto(false)
        boton.current?.focus()
      }
    }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  const iniciales = `${usuario?.nombres?.[0] ?? ''}${usuario?.apellidos?.[0] ?? ''}`.toUpperCase() || 'U'

  return (
    <div ref={contenedor} className="min-w-0 sm:relative">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-label={`Ver perfil de ${usuario?.nombres ?? ''} ${usuario?.apellidos ?? ''}`}
        className={`group flex min-w-0 items-center gap-3 rounded-full py-1 pl-1 pr-1 text-left transition-all active:scale-[0.98] sm:pr-3 sm:ring-1 ${
          abierto ? 'bg-brand-50 sm:ring-brand-300' : 'sm:ring-slate-200/80 hover:bg-slate-50 sm:hover:ring-slate-300'
        }`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-sm font-extrabold text-brand-950 ring-2 ring-white transition-transform group-hover:scale-105">
          {iniciales}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-semibold leading-tight text-slate-800">
            {usuario?.nombres} {usuario?.apellidos}
          </span>
          <span className="block text-xs text-slate-500">C.I. {usuario?.cedula}</span>
        </span>
        <Icon
          name="chevronRight"
          className={`hidden size-4 text-slate-400 transition-transform duration-200 sm:block ${abierto ? '-rotate-90' : 'rotate-90'}`}
          strokeWidth={2.2}
        />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Perfil del usuario"
          className="absolute inset-x-4 top-[calc(100%+0.25rem)] z-30 origin-top-right overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-slate-900/5 animate-dropdown sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.625rem)] sm:w-[23rem]"
        >
          <div className="relative overflow-hidden bg-brand-950 px-5 py-5 text-white">
            <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-40" />
            <div aria-hidden="true" className="absolute -right-12 -top-16 size-44 rounded-full bg-gold-500/25 blur-2xl" />
            <div className="relative flex items-center gap-3.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 font-extrabold text-brand-950">
                {iniciales}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold leading-tight">
                  {usuario?.nombres} {usuario?.apellidos}
                </p>
                <p className="mt-0.5 font-mono text-xs text-brand-100/80">C.I. {usuario?.cedula}</p>
                {usuario?.email && <p className="truncate text-xs text-brand-100/70">{usuario.email}</p>}
              </div>
            </div>
          </div>

          <section aria-labelledby="titulo-integrantes" className="px-5 py-4">
            <h2 id="titulo-integrantes" className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Icon name="users" className="size-[18px] text-brand-600" />
              Integrantes del grupo
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {ASIGNATURA} · {EVALUACION}
            </p>

            {INTEGRANTES.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {INTEGRANTES.map((nombre, i) => (
                  <li
                    key={nombre}
                    className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-50 animate-slide-down"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                      {inicialesDe(nombre)}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-slate-800">{nombre}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
                Los nombres de los integrantes aparecerán aquí.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
