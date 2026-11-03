import { Button, Icon, Sello } from '../../components/ui'
import { useCatalogo } from '../../hooks/useCatalogo'
import { formatoFecha, textoDuracion } from '../../utils/fechas'
import { Dato } from './components'

const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' }) : '—'

function Bloque({ titulo, children }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium">{titulo}</h3>
      {children}
    </div>
  )
}

/** Resumen imprimible de la postulación enviada: el documento con su código y su sello. */
export function Comprobante({ postulacion, celebrar = false }) {
  const sectores = useCatalogo('sectores')
  const d = postulacion.datosPersonales
  const c = postulacion.contacto
  const sector = sectores.data.find((s) => s.codigo === postulacion.sectorCodigo)

  return (
    <article className="rounded-lg border border-borde bg-papel print:border-0">
      <header className="flex flex-wrap items-start justify-between gap-6 p-4 sm:p-8">
        <div className="min-w-0">
          <h2 className="text-base font-medium">Comprobante de postulación</h2>
          <p className="text-sm text-tenue">Directorio del BIESS · Concurso Público de Méritos y Oposición</p>
          <p className="mt-6 text-xs text-tenue">Código único</p>
          <p className="break-all font-mono text-2xl tracking-tight sm:text-3xl">{postulacion.codigo}</p>
          <p className="mt-2 text-sm">Postulación recibida el {fechaHora(postulacion.fechaEnvio)}</p>
        </div>
        <Sello fecha={postulacion.fechaEnvio} caer={celebrar} />
      </header>

      <div className="space-y-8 border-t border-regla p-4 sm:p-8">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Postulante" valor={`${d.nombres} ${d.apellidos}`} />
          <Dato etiqueta="Cédula" valor={d.cedula} />
          <Dato etiqueta="Cargo" valor={sector?.cargo ?? postulacion.sectorCodigo} className="sm:col-span-2" />
          {postulacion.tieneRespaldo && (
            <Dato etiqueta="Organización que respalda" valor={postulacion.organizacionNombre} className="sm:col-span-2" />
          )}
          {c && <Dato etiqueta="Correo de contacto" valor={c.correo1} />}
          {c && <Dato etiqueta="Teléfono" valor={c.telefonoCelular} />}
        </dl>

        <Bloque titulo="Formación académica">
          <ul>
            {postulacion.formacion.map((f) => (
              <li key={f.id} className="border-b border-regla py-2.5 text-sm last:border-b-0">
                <p>{f.titulo}</p>
                <p className="text-xs text-tenue">
                  {f.institucion} · Registro {f.registroSenescyt} · {formatoFecha(f.fechaRegistro)}
                </p>
              </li>
            ))}
          </ul>
        </Bloque>

        <Bloque titulo="Experiencia profesional">
          <ul>
            {postulacion.experiencia.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-regla py-2.5 text-sm">
                <span className="min-w-0">
                  {e.cargo}
                  <span className="text-tenue"> · {e.institucion}</span>
                </span>
                <span className="tabular-nums text-tenue">{textoDuracion(e.duracion)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 text-sm font-medium">
            Total
            <span className="tabular-nums text-sello">{textoDuracion(postulacion.experienciaTotal?.total)}</span>
          </p>
        </Bloque>

        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato etiqueta="Familiares en IESS/BIESS" valor={postulacion.tieneFamiliares ? `Sí (${postulacion.familiares.length})` : 'No'} />
          <Dato etiqueta="Publicaciones" valor={postulacion.tienePublicaciones ? `Sí (${postulacion.publicaciones.length})` : 'No'} />
          <Dato etiqueta="Capacitaciones" valor={String(postulacion.capacitaciones.length)} />
        </dl>

        <p className="text-xs leading-relaxed text-tenue">
          Conserve este comprobante. Recuerde entregar el formulario firmado y los documentos de respaldo en la fecha y lugar que se le
          comuniquen.
        </p>
      </div>

      <footer className="no-print flex justify-end border-t border-regla px-4 py-4 sm:px-8">
        <Button variant="secondary" onClick={() => window.print()}>
          <Icon name="printer" className="size-4" />
          Imprimir comprobante
        </Button>
      </footer>
    </article>
  )
}
