import { EnlaceDocumento } from './components'

function Campos({ campos, descargar }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 print:grid-cols-2">
      {campos.map((c, i) => (
        <div key={`${c.etiqueta}-${i}`} className="min-w-0 break-inside-avoid">
          <dt className="text-xs text-tenue">{c.etiqueta}</dt>
          <dd className="mt-0.5 break-words text-sm">
            {c.documento ? <EnlaceDocumento documento={c.documento} descargar={descargar} /> : c.valor || <span className="text-tenue">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Formulario final (1.10): todos los campos, la declaración y el apartado de firma. Lo arma el
 * backend, de modo que la pantalla, el correo y el módulo de administración muestran lo mismo.
 * descargar: cómo bajar un PDF; por omisión, con la sesión del postulante.
 */
export function FormularioVista({ formulario, descargar }) {
  return (
    <div className="space-y-8">
      {formulario.secciones.map((s) => (
        <section key={s.numeral}>
          <h3 className="mb-3 border-b border-regla pb-2 text-base font-medium print:break-after-avoid">
            <span className="mr-2 tabular-nums text-tenue">{s.numeral}</span>
            {s.titulo}
          </h3>
          {s.campos?.length > 0 && <Campos campos={s.campos} descargar={descargar} />}
          {s.registros?.map((r) => (
            <div key={r.titulo} className="mt-4 break-inside-avoid rounded-md bg-fondo p-3 print:bg-white print:px-0">
              <p className="mb-2 text-sm font-medium">{r.titulo}</p>
              <Campos campos={r.campos} descargar={descargar} />
            </div>
          ))}
          {!s.campos?.length && !s.registros?.length && <p className="text-sm text-tenue">Sin registros.</p>}
        </section>
      ))}

      {/* En el papel la firma queda en la misma hoja que lo que se firma. */}
      <div className="space-y-8 break-inside-avoid">
        <section>
          <h3 className="mb-3 border-b border-regla pb-2 text-base font-medium">Declaración y consentimiento</h3>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed marker:tabular-nums marker:text-tenue">
            {formulario.consentimiento.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </section>

        {/* 1.10.2: la firma manuscrita se hace sobre el formulario impreso. */}
        <section className="pt-10 text-sm">
          <div className="w-full max-w-sm border-t border-tinta pt-2">
            <p className="font-medium">Firma del postulante</p>
            <p className="mt-1">{formulario.firmaNombres}</p>
            <p className="tabular-nums">Cédula: {formulario.firmaCedula}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
