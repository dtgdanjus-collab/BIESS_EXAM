import { Icon } from '../../components/ui'
import { Dato, EstadoBadge } from './components'

// Pantalla final cuando la postulación se cerró por nacionalidad no ecuatoriana.
export function PostulacionCerrada({ postulacion }) {
  const d = postulacion.datosPersonales
  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <div className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-slate-900/5">
        <div className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-700 to-red-900 px-6 py-10 text-center text-white sm:px-10">
          <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-40" />
          <span className="relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
            <Icon name="x" className="size-8" strokeWidth={2.4} />
          </span>
          <h1 className="relative mt-5 text-2xl font-extrabold tracking-tight">Postulación cerrada</h1>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-red-50">{postulacion.motivoCierre}</p>
        </div>

        <div className="px-6 py-7 sm:px-10">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Dato etiqueta="Código" valor={postulacion.codigo} />
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Estado</dt>
              <dd className="mt-1.5">
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
          <p className="mt-7 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
            <Icon name="info" className="mt-0.5 size-4 text-slate-400" />
            La decisión quedó registrada en el historial de la postulación. Si considera que su nacionalidad está mal
            registrada, actualícela en el Registro Civil.
          </p>
        </div>
      </div>
    </div>
  )
}
