import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { postulacionApi } from '../../api/postulacion'
import { Alert, Button, ErrorAlert, Icon, PageLoader, Sello } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { guardarArchivo } from '../../utils/descargas'
import { FormularioVista } from './FormularioVista'
import { HojaImpresion } from './HojaImpresion'

const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' }) : '—'

/** Portada con su código y su sello, seguida del formulario completo para imprimir y firmar. */
export function Comprobante({ postulacion, celebrar = false }) {
  const [formulario, setFormulario] = useState(null)
  const [fallo, setFallo] = useState(false)
  const descarga = useAsync()
  const reenvio = useAsync()

  useEffect(() => {
    let vigente = true
    Promise.resolve(postulacionApi.formulario())
      .then((f) => vigente && setFormulario(f ?? null))
      .catch(() => vigente && setFallo(true))
    return () => {
      vigente = false
    }
  }, [])

  const descargar = async () => {
    const r = await descarga.run(postulacionApi.formularioPdf)
    if (r.ok) guardarArchivo(r.data, `Formulario-${postulacion.codigo}.pdf`)
  }

  return (
    <article className="overflow-hidden rounded-lg border border-borde bg-papel">
      <header className="grid sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 bg-noche p-5 text-white sm:p-8">
          <h2 className="text-lg font-medium">Comprobante de postulación</h2>
          <p className="text-sm text-noche-tenue">Directorio del BIESS · Concurso Público de Méritos y Oposición</p>
          <p className="mt-8 text-xs text-noche-tenue">Código único</p>
          <p className="break-all font-mono text-2xl tracking-tight sm:text-[32px]">{postulacion.codigo}</p>
          <p className="mt-2 text-sm">Postulación recibida el {fechaHora(postulacion.fechaEnvio)}</p>
        </div>
        <div className="flex items-center justify-center p-5 sm:px-10">
          <Sello fecha={postulacion.fechaEnvio} caer={celebrar} />
        </div>
      </header>

      <div className="border-t border-regla p-5 sm:p-8">
        {formulario && <FormularioVista formulario={formulario} />}
        {formulario && <HojaImpresion formulario={formulario} />}
        {fallo && <Alert type="error">No se pudo cargar el formulario. Recargue la página para intentarlo otra vez.</Alert>}
        {!formulario && !fallo && <PageLoader texto="Cargando el formulario…" />}
      </div>

      <footer className="no-print space-y-3 border-t border-regla bg-[#fafafa] px-5 py-4 sm:px-8">
        <ErrorAlert error={descarga.error ?? reenvio.error} />
        {reenvio.success && <Alert type="success">Le enviamos el formulario en PDF a {reenvio.data?.correo}. Si no lo ve, revise también el correo no deseado.</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          <Link to="/concurso" className="inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium underline-offset-4 hover:underline">
            Ver el avance del concurso
          </Link>
          <Button variant="secondary" onClick={() => reenvio.run(postulacionApi.reenviarFormulario)} loading={reenvio.loading}>
            <Icon name="mail" className="size-4" />
            Enviar a mi correo
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Icon name="printer" className="size-4" />
            Imprimir comprobante
          </Button>
          <Button onClick={descargar} loading={descarga.loading}>
            <Icon name="download" className="size-4" />
            Descargar PDF
          </Button>
        </div>
      </footer>
    </article>
  )
}
