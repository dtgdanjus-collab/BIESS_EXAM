import { Dato, EstadoBadge } from './components'

// Pantalla final cuando la postulación se cerró por nacionalidad no ecuatoriana.
export function PostulacionCerrada({ postulacion }) {
  const d = postulacion.datosPersonales
  return (
    <div className="grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium tracking-tight">Postulación cerrada</h1>
          <EstadoBadge estado={postulacion.estado} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-tenue">
          La decisión quedó registrada en el historial de la postulación. Si considera que su nacionalidad está mal registrada, actualícela
          en el Registro Civil.
        </p>
      </div>
      <div className="rounded-lg border border-borde bg-papel p-4 sm:p-6">
        <p className="rounded-md bg-mal-fondo px-3 py-2.5 text-sm leading-relaxed text-mal-tinta">{postulacion.motivoCierre}</p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Código" valor={<span className="font-mono">{postulacion.codigo}</span>} />
          {d && (
            <>
              <Dato etiqueta="Nacionalidad registrada" valor={d.nacionalidad} />
              <Dato etiqueta="Postulante" valor={`${d.nombres} ${d.apellidos}`} className="sm:col-span-2" />
            </>
          )}
        </dl>
      </div>
    </div>
  )
}
