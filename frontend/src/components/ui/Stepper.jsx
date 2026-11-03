import { Icon } from './Icon'

/**
 * Índice de folios para la barra lateral.
 * steps: [{ id, titulo, numeral, completo }]; actual: id del folio visible.
 */
export function Stepper({ steps, actual, onSelect }) {
  return (
    <nav aria-label="Secciones del formulario">
      <p className="mb-1.5 px-3 text-xs text-tenue">Folios del expediente</p>
      <ol>
        {steps.map((s) => {
          const activo = s.id === actual
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={activo ? 'step' : undefined}
                className={`flex min-h-8 w-full items-center gap-2 rounded-md px-3 py-1 text-left text-sm transition-colors ${
                  activo ? 'bg-realce' : 'hover:bg-realce/60'
                }`}
              >
                <span className="w-7 shrink-0 text-xs tabular-nums text-tenue">{s.numeral}</span>
                <span className="min-w-0 flex-1 truncate">{s.titulo}</span>
                {s.completo && (
                  <span key="completo" className="text-sello animate-pop">
                    <Icon name="check" className="size-4" strokeWidth={2.4} />
                    <span className="sr-only">completa</span>
                  </span>
                )}
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
 * El pliego: una marca por folio. Lo asentado va en tinta de sello, el folio abierto en negro
 * y lo pendiente en gris. Cada marca lleva a su folio.
 */
export function Pliego({ steps, actual, onSelect }) {
  return (
    <ol className="flex gap-1" aria-label="Avance por folio">
      {steps.map((s) => (
        <li key={s.id} className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSelect(s.id)}
            aria-label={`Ir al folio ${s.numeral} ${s.titulo}`}
            title={`${s.numeral} ${s.titulo}`}
            className="group flex h-11 w-full items-center lg:h-6"
          >
            <span
              className={`block h-2 w-full transition-[background-color,transform] duration-200 group-hover:scale-y-150 ${
                s.completo ? 'bg-sello' : s.id === actual ? 'bg-tinta' : 'bg-control'
              }`}
            />
          </button>
        </li>
      ))}
    </ol>
  )
}
