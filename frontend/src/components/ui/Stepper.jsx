/**
 * Navegación por secciones del formulario.
 * steps: [{ id, titulo, completo }]; actual: id de la sección visible.
 */
export function Stepper({ steps, actual, onSelect }) {
  const indice = steps.findIndex((s) => s.id === actual)
  return (
    <nav aria-label="Secciones del formulario">
      {/* Móvil: selector compacto */}
      <div className="lg:hidden">
        <label htmlFor="stepper-movil" className="mb-1 block text-xs font-medium text-slate-500">
          Sección {indice + 1} de {steps.length}
        </label>
        <select
          id="stepper-movil"
          value={actual}
          onChange={(e) => onSelect(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
        >
          {steps.map((s, i) => (
            <option key={s.id} value={s.id}>
              {i + 1}. {s.titulo} {s.completo ? '✔' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Escritorio: lista vertical */}
      <ol className="hidden space-y-1 lg:block">
        {steps.map((s, i) => {
          const activo = s.id === actual
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={activo ? 'step' : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activo ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.completo
                      ? 'bg-brand-600 text-white'
                      : activo
                        ? 'border-2 border-brand-600 text-brand-700'
                        : 'border border-slate-300 text-slate-500'
                  }`}
                >
                  {s.completo ? '✓' : i + 1}
                </span>
                <span className="min-w-0 truncate">{s.titulo}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
