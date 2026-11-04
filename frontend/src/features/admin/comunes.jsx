/** Convierte una fecha de la API al formato de un <input type="datetime-local">, en hora local. */
export const aLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const dos = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}
export const aIso = (local) => (local ? new Date(local).toISOString() : null)

export const nota = (n) => <span className="tabular-nums">{n === null || n === undefined ? '—' : n.toFixed(2)}</span>

export function Titulo({ texto, detalle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-medium tracking-tight">{texto}</h1>
        {detalle && <p className="mt-1 text-sm text-tenue">{detalle}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Panel({ titulo, children }) {
  return (
    <section className="rounded-lg border border-borde bg-papel p-4 sm:p-6">
      {titulo && <h2 className="mb-4 text-base font-medium">{titulo}</h2>}
      {children}
    </section>
  )
}

/** Tabla con desplazamiento propio: en el teléfono no ensancha la página. */
export function Tabla({ columnas, filas, vacio = 'Sin registros.' }) {
  if (filas.length === 0) return <p className="text-sm text-tenue">{vacio}</p>
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6" tabIndex={0} role="region" aria-label="Tabla">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-borde text-xs text-tenue">
            {columnas.map((c, i) => (
              <th key={i} scope="col" className="py-2 pr-4 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-regla last:border-b-0">
              {f.map((celda, j) => (
                <td key={j} className="py-2.5 pr-4 align-top">{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
