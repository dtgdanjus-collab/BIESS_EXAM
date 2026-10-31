import { Button } from '../../components/ui'
import { useCatalogo } from '../../hooks/useCatalogo'
import { formatoFecha, textoDuracion } from '../../utils/fechas'
import { Dato } from './components'

const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' }) : '—'

/** Resumen imprimible de la postulación enviada con su código único. */
export function Comprobante({ postulacion }) {
  const sectores = useCatalogo('sectores')
  const d = postulacion.datosPersonales
  const c = postulacion.contacto
  const sector = sectores.data.find((s) => s.codigo === postulacion.sectorCodigo)

  return (
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Comprobante de postulación</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Directorio del BIESS</h2>
          <p className="text-sm text-slate-500">Concurso Público de Méritos y Oposición</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Código único</p>
          <p className="font-mono text-xl font-bold text-brand-800">{postulacion.codigo}</p>
        </div>
      </header>

      <div className="space-y-6 px-6 py-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Postulante" valor={`${d.nombres} ${d.apellidos}`} />
          <Dato etiqueta="Cédula" valor={d.cedula} />
          <Dato etiqueta="Fecha de envío" valor={fechaHora(postulacion.fechaEnvio)} />
          <Dato etiqueta="Estado" valor={postulacion.estado} />
          <Dato etiqueta="Cargo" valor={sector?.cargo ?? postulacion.sectorCodigo} className="sm:col-span-2" />
          {postulacion.tieneRespaldo && (
            <Dato etiqueta="Organización que respalda" valor={postulacion.organizacionNombre} className="sm:col-span-2" />
          )}
          {c && <Dato etiqueta="Correo de contacto" valor={c.correo1} />}
          {c && <Dato etiqueta="Teléfono" valor={c.telefonoCelular} />}
        </dl>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Formación académica</h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {postulacion.formacion.map((f) => (
              <li key={f.id}>
                {f.titulo} — {f.institucion} (registro {f.registroSenescyt}, {formatoFecha(f.fechaRegistro)})
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Experiencia profesional</h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {postulacion.experiencia.map((e) => (
              <li key={e.id}>
                {e.cargo} — {e.institucion}: {textoDuracion(e.duracion)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            Total: {textoDuracion(postulacion.experienciaTotal?.total)}
          </p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato etiqueta="Familiares en IESS/BIESS" valor={postulacion.tieneFamiliares ? `Sí (${postulacion.familiares.length})` : 'No'} />
          <Dato etiqueta="Publicaciones" valor={postulacion.tienePublicaciones ? `Sí (${postulacion.publicaciones.length})` : 'No'} />
          <Dato etiqueta="Capacitaciones" valor={String(postulacion.capacitaciones.length)} />
        </dl>

        <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          Conserve este comprobante. Recuerde entregar el formulario firmado y los documentos de respaldo en la fecha
          y lugar que se le comuniquen.
        </p>
      </div>

      <footer className="no-print flex justify-end border-t border-slate-100 px-6 py-4">
        <Button variant="secondary" onClick={() => window.print()}>
          Imprimir comprobante
        </Button>
      </footer>
    </article>
  )
}
