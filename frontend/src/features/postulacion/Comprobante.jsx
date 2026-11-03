import { Button, Icon, Sello } from '../../components/ui'
import { useCatalogo } from '../../hooks/useCatalogo'
import { formatoFecha, textoDuracion } from '../../utils/fechas'
import { Dato } from './components'

const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' }) : '—'

function Bloque({ titulo, children }) {
  return (
    <div>
      <h3 className="mb-1 text-base font-medium">{titulo}</h3>
      {children}
    </div>
  )
}

/** Resumen imprimible de la postulación enviada: una portada con su código y su sello. */
export function Comprobante({ postulacion, celebrar = false }) {
  const sectores = useCatalogo('sectores')
  const d = postulacion.datosPersonales
  const c = postulacion.contacto
  const sector = sectores.data.find((s) => s.codigo === postulacion.sectorCodigo)

  return (
    <article className="overflow-hidden rounded-lg border border-borde bg-papel print:border-0">
      <header className="grid sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 bg-noche p-5 text-white sm:p-8 print:bg-white print:text-tinta">
          <h2 className="text-lg font-medium">Comprobante de postulación</h2>
          <p className="text-sm text-noche-tenue print:text-tenue">Directorio del BIESS · Concurso Público de Méritos y Oposición</p>
          <p className="mt-8 text-xs text-noche-tenue print:text-tenue">Código único</p>
          <p className="break-all font-mono text-2xl tracking-tight sm:text-[32px]">{postulacion.codigo}</p>
          <p className="mt-2 text-sm">Postulación recibida el {fechaHora(postulacion.fechaEnvio)}</p>
        </div>
        <div className="flex items-center justify-center p-5 sm:px-10">
          <Sello fecha={postulacion.fechaEnvio} caer={celebrar} />
        </div>
      </header>

      <div className="space-y-8 border-t border-regla p-5 sm:p-8">
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

        <dl className="grid gap-px overflow-hidden rounded-md bg-regla sm:grid-cols-3">
          {[
            ['Familiares en IESS/BIESS', postulacion.tieneFamiliares ? `Sí (${postulacion.familiares.length})` : 'No'],
            ['Publicaciones', postulacion.tienePublicaciones ? `Sí (${postulacion.publicaciones.length})` : 'No'],
            ['Capacitaciones', String(postulacion.capacitaciones.length)],
          ].map(([etiqueta, valor]) => (
            <Dato key={etiqueta} etiqueta={etiqueta} valor={valor} className="bg-[#fafafa] p-3" />
          ))}
        </dl>

        <p className="text-xs leading-relaxed text-tenue">
          Conserve este comprobante. Recuerde entregar el formulario firmado y los documentos de respaldo en la fecha y lugar que se le
          comuniquen.
        </p>
      </div>

      <footer className="no-print flex justify-end border-t border-regla bg-[#fafafa] px-5 py-4 sm:px-8">
        <Button variant="secondary" onClick={() => window.print()}>
          <Icon name="printer" className="size-4" />
          Imprimir comprobante
        </Button>
      </footer>
    </article>
  )
}
