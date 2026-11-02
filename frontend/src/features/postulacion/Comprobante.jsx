import { Button, Confetti, Icon } from '../../components/ui'
import { useCatalogo } from '../../hooks/useCatalogo'
import { formatoFecha, textoDuracion } from '../../utils/fechas'
import { Dato } from './components'

const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' }) : '—'

function Bloque({ titulo, icono, children }) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        <Icon name={icono} className="size-4 text-brand-600" />
        {titulo}
      </h3>
      {children}
    </div>
  )
}

/** Resumen imprimible de la postulación enviada con su código único. */
export function Comprobante({ postulacion, celebrar = false }) {
  const sectores = useCatalogo('sectores')
  const d = postulacion.datosPersonales
  const c = postulacion.contacto
  const sector = sectores.data.find((s) => s.codigo === postulacion.sectorCodigo)

  return (
    <article className="relative overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-slate-900/5 print:rounded-none print:shadow-none print:ring-0">
      {celebrar && <Confetti />}
      {/* Encabezado del documento */}
      <header className="relative overflow-hidden bg-brand-950 px-6 py-7 text-white sm:px-9 print:bg-white print:text-slate-900">
        <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-40 print:hidden" />
        <div aria-hidden="true" className="absolute -right-20 -top-24 size-72 rounded-full bg-gold-500/25 blur-3xl print:hidden" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-300 print:text-brand-700">
              Comprobante de postulación
            </p>
            <h2 className="mt-1.5 text-xl font-extrabold tracking-tight">Directorio del BIESS</h2>
            <p className="text-sm text-brand-100/70 print:text-slate-500">Concurso Público de Méritos y Oposición</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right ring-1 ring-inset ring-white/20 print:ring-slate-300">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-100/70 print:text-slate-500">
              Código único
            </p>
            <p className="font-mono text-2xl font-bold tracking-wide text-gold-200 print:text-brand-800">{postulacion.codigo}</p>
          </div>
        </div>
      </header>

      {/* Sello de recepción */}
      <div className="flex items-center gap-3 border-b border-dashed border-slate-200 bg-emerald-50/70 px-6 py-3 text-sm text-emerald-900 sm:px-9">
        <span className={`flex size-7 items-center justify-center rounded-full bg-emerald-500 text-white ${celebrar ? 'animate-stamp' : ''}`}>
          <Icon name="check" className="size-4" strokeWidth={3} />
        </span>
        <p>
          <span className="font-bold">Postulación recibida</span> el {fechaHora(postulacion.fechaEnvio)}
        </p>
      </div>

      <div className="space-y-8 px-6 py-8 sm:px-9">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Dato etiqueta="Postulante" valor={`${d.nombres} ${d.apellidos}`} />
          <Dato etiqueta="Cédula" valor={d.cedula} />
          <Dato etiqueta="Cargo" valor={sector?.cargo ?? postulacion.sectorCodigo} className="sm:col-span-2" />
          {postulacion.tieneRespaldo && (
            <Dato etiqueta="Organización que respalda" valor={postulacion.organizacionNombre} className="sm:col-span-2" />
          )}
          {c && <Dato etiqueta="Correo de contacto" valor={c.correo1} />}
          {c && <Dato etiqueta="Teléfono" valor={c.telefonoCelular} />}
        </dl>

        <Bloque titulo="Formación académica" icono="graduation">
          <ul className="space-y-2">
            {postulacion.formacion.map((f) => (
              <li key={f.id} className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">{f.titulo}</p>
                <p className="text-slate-500">
                  {f.institucion} · Registro {f.registroSenescyt} · {formatoFecha(f.fechaRegistro)}
                </p>
              </li>
            ))}
          </ul>
        </Bloque>

        <Bloque titulo="Experiencia profesional" icono="chart">
          <ul className="space-y-2">
            {postulacion.experiencia.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold text-slate-900">{e.cargo}</span>
                  <span className="text-slate-500"> · {e.institucion}</span>
                </span>
                <span className="font-medium text-brand-700">{textoDuracion(e.duracion)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-right text-sm font-bold text-slate-900">
            Total: <span className="text-brand-700">{textoDuracion(postulacion.experienciaTotal?.total)}</span>
          </p>
        </Bloque>

        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            ['Familiares en IESS/BIESS', postulacion.tieneFamiliares ? `Sí (${postulacion.familiares.length})` : 'No'],
            ['Publicaciones', postulacion.tienePublicaciones ? `Sí (${postulacion.publicaciones.length})` : 'No'],
            ['Capacitaciones', String(postulacion.capacitaciones.length)],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="rounded-xl border border-slate-200 px-4 py-3">
              <Dato etiqueta={etiqueta} valor={valor} />
            </div>
          ))}
        </dl>

        <p className="flex items-start gap-2 rounded-xl bg-gold-100/70 px-4 py-3 text-xs leading-relaxed text-gold-600">
          <Icon name="info" className="mt-0.5 size-4" />
          Conserve este comprobante. Recuerde entregar el formulario firmado y los documentos de respaldo en la fecha y
          lugar que se le comuniquen.
        </p>
      </div>

      <footer className="no-print flex justify-end border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-9">
        <Button variant="secondary" onClick={() => window.print()}>
          <Icon name="printer" className="size-4" />
          Imprimir comprobante
        </Button>
      </footer>
    </article>
  )
}
