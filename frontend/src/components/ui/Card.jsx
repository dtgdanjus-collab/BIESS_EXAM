/**
 * Folio del expediente: a la izquierda su numeral, título y descripción; a la derecha el pliego
 * con el contenido. pie: barra inferior del pliego; nota: texto de apoyo bajo la descripción.
 */
export function Card({ numeral, title, description, nota, children, pie, className = '' }) {
  return (
    <section className={`grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-8 ${className}`}>
      <header className="xl:sticky xl:top-8 xl:self-start">
        <h2 className="text-base font-medium">
          {numeral && <span className="mr-2 font-normal tabular-nums text-tenue">{numeral}</span>}
          {title}
        </h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-tenue">{description}</p>}
        {nota && <div className="mt-4 hidden text-xs leading-relaxed text-tenue xl:block">{nota}</div>}
      </header>
      <div className="min-w-0 rounded-lg border border-borde bg-papel">
        <div className="p-4 sm:p-6">{children}</div>
        {pie && <div className="space-y-3 border-t border-regla px-4 py-4 sm:px-6">{pie}</div>}
      </div>
    </section>
  )
}
