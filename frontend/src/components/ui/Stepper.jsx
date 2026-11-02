import { useLayoutEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

/**
 * Navegación por secciones del formulario. Un indicador se desliza hasta la sección activa.
 * steps: [{ id, titulo, numeral, icono, completo }]; actual: id de la sección visible.
 */
export function Stepper({ steps, actual, onSelect }) {
  const indice = steps.findIndex((s) => s.id === actual)
  const lista = useRef(null)
  const [indicador, setIndicador] = useState(null)

  // Mide la fila activa para colocar el indicador sobre ella.
  useLayoutEffect(() => {
    const medir = () => {
      // Se mide el <li>: el offsetTop del botón es relativo a su fila, no a la lista.
      const fila = lista.current?.querySelector('[aria-current="step"]')?.parentElement
      if (fila) setIndicador({ top: fila.offsetTop, height: fila.offsetHeight })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [actual])

  return (
    <nav aria-label="Secciones del formulario">
      {/* Móvil: selector compacto */}
      <div className="lg:hidden">
        <label htmlFor="stepper-movil" className="mb-1.5 block text-xs font-semibold text-slate-500">
          Sección {indice + 1} de {steps.length}
        </label>
        <select
          id="stepper-movil"
          value={actual}
          onChange={(e) => onSelect(e.target.value)}
          className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold"
        >
          {steps.map((s, i) => (
            <option key={s.id} value={s.id}>
              {i + 1}. {s.titulo} {s.completo ? '✔' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Escritorio: lista vertical con línea de conexión */}
      <ol ref={lista} className="relative hidden lg:block">
        {indicador && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 rounded-xl bg-brand-50 ring-1 ring-inset ring-brand-100 transition-all duration-300 ease-out"
            style={{ top: indicador.top, height: indicador.height }}
          />
        )}
        <span aria-hidden="true" className="absolute bottom-5 left-[27px] top-5 w-px bg-slate-200" />
        {steps.map((s) => {
          const activo = s.id === actual
          return (
            <li key={s.id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={activo ? 'step' : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors active:scale-[0.99] ${
                  activo ? '' : 'hover:bg-slate-50'
                }`}
              >
                <span
                  className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white transition-all duration-200 group-hover:scale-110 ${
                    s.completo
                      ? 'bg-brand-600 text-white'
                      : activo
                        ? 'bg-white text-brand-700 outline-2 outline-brand-600'
                        : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
                  }`}
                >
                  <Icon
                    key={s.completo ? 'completo' : 'pendiente'}
                    name={s.completo ? 'check' : s.icono}
                    className={`size-4 ${s.completo ? 'animate-pop' : ''}`}
                    strokeWidth={s.completo ? 2.6 : 2}
                  />
                </span>
                <span className="min-w-0 transition-transform duration-200 group-hover:translate-x-0.5">
                  <span className={`block text-[11px] font-semibold ${activo ? 'text-brand-600' : 'text-slate-400'}`}>
                    {s.numeral}
                  </span>
                  <span
                    className={`block truncate leading-tight transition-colors ${activo ? 'font-bold text-brand-900' : 'font-medium text-slate-600'}`}
                  >
                    {s.titulo}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
