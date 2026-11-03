import { Icon } from './Icon'

/** Celda del índice: el mismo lenguaje que los dígitos de la cédula en el acceso. */
const celdaFolio = (completo, activo) => {
  if (completo) return 'bg-sello text-white'
  if (activo) return 'bg-white text-tinta'
  return 'bg-noche-celda text-noche-tenue'
}

/**
 * Índice de folios para la barra lateral.
 * steps: [{ id, titulo, numeral, completo }]; actual: id del folio visible.
 */
export function Stepper({ steps, actual, onSelect }) {
  return (
    <nav aria-label="Secciones del formulario">
      <p className="mb-2 px-2 text-xs text-noche-tenue">Folios del expediente</p>
      <ol className="space-y-0.5">
        {steps.map((s) => {
          const activo = s.id === actual
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={activo ? 'step' : undefined}
                className={`flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 py-1 text-left text-sm transition-colors ${
                  activo ? 'bg-noche-celda text-white' : 'text-[#dcdcdc] hover:bg-white/10 hover:text-white'
                }`}
              >
                <span
                  className={`flex h-7 w-9 shrink-0 items-center justify-center text-xs font-medium tabular-nums transition-colors ${celdaFolio(s.completo, activo)}`}
                >
                  {s.completo ? <Icon name="check" className="size-4 animate-pop" strokeWidth={2.6} /> : s.numeral}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.titulo}</span>
                {s.completo && <span className="sr-only">completa</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Selector de folios para el teléfono y la tableta, donde la barra lateral se pliega. */
export function SelectorFolios({ steps, actual, onSelect }) {
  const indice = steps.findIndex((s) => s.id === actual)
  return (
    <div className="lg:hidden">
      <label htmlFor="selector-folios" className="mb-1.5 block text-xs text-tenue">
        Folio {indice + 1} de {steps.length}
      </label>
      <select
        id="selector-folios"
        value={actual}
        onChange={(e) => onSelect(e.target.value)}
        className="block min-h-11 w-full rounded-md border border-control bg-papel px-3 text-sm font-medium"
      >
        {steps.map((s) => (
          <option key={s.id} value={s.id}>
            {s.numeral} {s.titulo} {s.completo ? '(completa)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * El pliego: una marca por folio sobre la cabecera negra. Lo asentado va en azul de sello,
 * el folio abierto en blanco y lo pendiente en gris. Cada marca lleva a su folio.
 */
export function Pliego({ steps, actual, onSelect }) {
  return (
    <ol className="flex gap-1" aria-label="Avance por folio">
      {steps.map((s) => {
        const activo = s.id === actual
        return (
          <li key={s.id} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              aria-label={`Ir al folio ${s.numeral} ${s.titulo}`}
              title={`${s.numeral} ${s.titulo}`}
              className="group flex h-11 w-full flex-col justify-center gap-1.5 lg:h-10"
            >
              <span
                className={`block h-3 w-full transition-colors duration-200 ${
                  s.completo ? 'bg-sello group-hover:bg-[#3b7fe0]' : activo ? 'bg-white' : 'bg-[#3a3a3a] group-hover:bg-[#555]'
                }`}
              />
              <span aria-hidden="true" className={`hidden text-left text-xs tabular-nums lg:block ${activo ? 'text-white' : 'text-noche-tenue'}`}>
                {s.numeral}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
