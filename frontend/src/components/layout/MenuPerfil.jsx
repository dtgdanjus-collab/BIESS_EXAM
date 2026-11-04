import { useEffect, useRef, useState } from 'react'
import { ASIGNATURA, EVALUACION, INTEGRANTES } from '../../config/integrantes'
import { useInstalacion } from '../../hooks/useInstalacion'
import { useAuthStore } from '../../store/authStore'
import { Button, Icon } from '../ui'

const inicialesDe = (texto = '') =>
  texto
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

/** Ficha del usuario en la barra lateral: al pulsarla despliega su perfil y los integrantes del grupo. */
export function MenuPerfil() {
  const usuario = useAuthStore((s) => s.usuario)
  const instalacion = useInstalacion()
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
    <div ref={contenedor} className="min-w-0 flex-1 lg:relative">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-label={`Ver perfil de ${usuario?.nombres ?? ''} ${usuario?.apellidos ?? ''}`}
        className={`flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left transition-colors pointer-fine:lg:min-h-10 ${
          abierto ? 'bg-white/15' : 'hover:bg-white/10'
        }`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-medium text-tinta">{iniciales}</span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm leading-tight" title={`${usuario?.nombres ?? ''} ${usuario?.apellidos ?? ''}`}>
            {usuario?.nombres} {usuario?.apellidos}
          </span>
          <span className="block font-mono text-xs text-noche-tenue">{usuario?.cedula}</span>
        </span>
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Perfil del usuario"
          className="absolute inset-x-4 top-[calc(100%+0.25rem)] z-30 rounded-lg border border-borde bg-papel text-tinta shadow-flota animate-dropdown sm:left-auto sm:w-[23rem] lg:inset-x-auto lg:bottom-[calc(100%+0.5rem)] lg:left-0 lg:top-auto lg:w-[23rem]"
        >
          <div className="px-4 py-4">
            <p className="truncate text-base font-medium leading-tight">
              {usuario?.nombres} {usuario?.apellidos}
            </p>
            <p className="mt-1 font-mono text-xs text-tenue">{usuario?.cedula}</p>
            {usuario?.email && <p className="truncate text-xs text-tenue">{usuario.email}</p>}
          </div>

          <section aria-labelledby="titulo-integrantes" className="border-t border-regla px-4 py-4">
            <h2 id="titulo-integrantes" className="flex items-center gap-2 text-sm font-medium">
              <Icon name="users" className="size-4 text-tenue" />
              Integrantes del grupo
            </h2>
            <p className="mt-0.5 text-xs text-tenue">
              {ASIGNATURA} · {EVALUACION}
            </p>

            {INTEGRANTES.length > 0 ? (
              <ul className="mt-3">
                {INTEGRANTES.map((nombre) => (
                  <li key={nombre} className="flex items-center gap-2.5 py-1.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-realce text-xs font-medium">
                      {inicialesDe(nombre)}
                    </span>
                    <span className="min-w-0 text-sm">{nombre}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-md border border-dashed border-control px-3 py-3 text-xs text-tenue">
                Los nombres de los integrantes aparecerán aquí.
              </p>
            )}
          </section>

          {(instalacion.puedeInstalar || instalacion.pasosIos) && (
            <section aria-labelledby="titulo-instalar" className="border-t border-regla px-4 py-4">
              <h2 id="titulo-instalar" className="text-sm font-medium">
                Instalar app
              </h2>
              {instalacion.puedeInstalar ? (
                <>
                  <p className="mt-0.5 text-xs text-tenue">Ábrala desde su pantalla de inicio, como cualquier otra app.</p>
                  <Button variant="secondary" onClick={instalacion.instalar} className="mt-3 w-full">
                    Instalar app
                  </Button>
                </>
              ) : (
                <p className="mt-0.5 text-xs text-tenue">En Safari, pulse Compartir y luego «Agregar a inicio».</p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
