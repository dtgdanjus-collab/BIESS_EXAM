import { Icon } from './Icon'

/**
 * Navegación por secciones del formulario.
 * steps: [{ id, titulo, numeral, icono, completo }]; actual: id de la sección visible.
 */
export function Stepper({ steps, actual, onSelect }) {
  const indice = steps.findIndex((s) => s.id === actual)
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
      <ol className="relative hidden lg:block">
        <span aria-hidden="true" className="absolute bottom-5 left-[27px] top-5 w-px bg-slate-200" />
        {steps.map((s) => {
          const activo = s.id === actual
          return (
            <li key={s.id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={activo ? 'step' : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  activo ? 'bg-brand-50' : 'hover:bg-slate-50'
                }`}
              >
                <span
                  className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white transition-colors ${
                    s.completo
                      ? 'bg-brand-600 text-white'
                      : activo
                        ? 'bg-white text-brand-700 outline-2 outline-brand-600'
                        : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
                  }`}
                >
                  <Icon name={s.completo ? 'check' : s.icono} className="size-4" strokeWidth={s.completo ? 2.6 : 2} />
                </span>
                <span className="min-w-0">
                  <span className={`block text-[11px] font-semibold ${activo ? 'text-brand-600' : 'text-slate-400'}`}>
                    {s.numeral}
                  </span>
                  <span
                    className={`block truncate leading-tight ${activo ? 'font-bold text-brand-900' : 'font-medium text-slate-600'}`}
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
