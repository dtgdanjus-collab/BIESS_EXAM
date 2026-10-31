import { Card } from '../../components/ui'
import { Dato, EstadoBadge } from './components'

// Pantalla final cuando la postulación se cerró por nacionalidad no ecuatoriana.
export function PostulacionCerrada({ postulacion }) {
  const d = postulacion.datosPersonales
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-600 text-xl font-bold text-white">
          ✖
        </span>
        <h1 className="mt-4 text-lg font-bold text-red-900">Postulación cerrada</h1>
        <p className="mt-2 text-sm leading-relaxed text-red-800">{postulacion.motivoCierre}</p>
      </div>
      <Card title="Datos de la postulación">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Código" valor={postulacion.codigo} />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Estado</dt>
            <dd className="mt-1">
              <EstadoBadge estado={postulacion.estado} />
            </dd>
          </div>
          {d && (
            <>
              <Dato etiqueta="Postulante" valor={`${d.nombres} ${d.apellidos}`} />
              <Dato etiqueta="Nacionalidad registrada" valor={d.nacionalidad} />
            </>
          )}
        </dl>
      </Card>
    </div>
  )
}
