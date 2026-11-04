import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { postulacionApi } from '../../api/postulacion'
import { Alert, Button, ErrorAlert, PageLoader, Select, Textarea } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useTituloPagina } from '../../hooks/useTituloPagina'
import { formatoInstante, ListaFases } from './componentes'

const ETIQUETA_ESTADO = {
  POSTULADO: 'Postulación en revisión',
  NO_SUPERA_MERITOS: 'No superó la fase de méritos',
  EVALUACION_TECNICA: 'Evaluación Técnica',
}
const ETAPAS = [
  { id: 'MERITOS', nombre: 'Fase de méritos' },
  { id: 'EVALUACION_TECNICA', nombre: 'Evaluación técnica' },
  { id: 'PSICOTECNICA', nombre: 'Evaluación psicotécnica' },
]
const ESTADO_RECONSIDERACION = { PENDIENTE: 'Pendiente', ACEPTADA: 'Aceptada', NEGADA: 'Negada' }

function Nota({ etiqueta, valor }) {
  return (
    <div className="bg-[#fafafa] p-3">
      <dt className="text-xs text-tenue">{etiqueta}</dt>
      <dd className="mt-0.5 text-lg font-medium tabular-nums">{valor ?? '—'}</dd>
    </div>
  )
}

/** Solicitud de reconsideración, disponible solo durante esa fase. */
function FormularioReconsideracion({ onEnviada }) {
  const peticion = useAsync()
  const [etapa, setEtapa] = useState('')
  const [motivo, setMotivo] = useState('')
  const campos = peticion.error?.details?.campos

  const enviar = async (e) => {
    e.preventDefault()
    const r = await peticion.run(() => postulacionApi.reconsiderar({ etapa, motivo }))
    if (r.ok) {
      setEtapa('')
      setMotivo('')
      onEnviada(r.data)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
      <Select label="Etapa" required options={ETAPAS} value={etapa} error={campos?.etapa} onChange={(e) => setEtapa(e.target.value)} />
      <Textarea label="Motivo" required maxLength={2000} value={motivo} error={campos?.motivo} onChange={(e) => setMotivo(e.target.value)} />
      {!campos && <ErrorAlert error={peticion.error} />}
      <Button type="submit" loading={peticion.loading}>
        Solicitar reconsideración
      </Button>
    </form>
  )
}

/** Avance del postulante en el concurso. La evaluación solo aparece si superó los méritos. */
export function MiConcursoPage() {
  useTituloPagina('Avance del concurso')
  const carga = useAsync()
  const [datos, setDatos] = useState(null)

  const cargar = useCallback(async () => {
    const r = await carga.run(postulacionApi.concurso)
    if (r.ok) setDatos(r.data)
  }, [carga.run])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (carga.loading && !datos) return <PageLoader texto="Cargando…" />
  if (!datos) return <ErrorAlert error={carga.error} title="No se pudo cargar el avance del concurso" />

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/formulario" className="text-sm underline underline-offset-4">
          Volver al formulario
        </Link>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">Avance del concurso</h1>
        {datos.estadoConcurso && <p className="mt-1 text-sm text-tenue">{ETIQUETA_ESTADO[datos.estadoConcurso]}</p>}
      </div>

      {datos.evaluacion && (
        <Alert type="info" title="Evaluación técnica">
          Usted superó la fase de méritos.{' '}
          <Link to="/evaluacion" className="font-medium underline underline-offset-4">
            Ir a la evaluación
          </Link>
        </Alert>
      )}

      {datos.estadoConcurso && (
        <dl className="grid gap-px overflow-hidden rounded-md border border-borde bg-regla sm:grid-cols-3">
          <Nota etiqueta="Puntaje de méritos" valor={datos.puntajeMeritos} />
          <Nota etiqueta="Evaluación teórica" valor={datos.notaTeorica} />
          <Nota etiqueta="Evaluación psicotécnica" valor={datos.notaPsicotecnica} />
        </dl>
      )}

      <section className="rounded-lg border border-borde bg-papel p-4 sm:p-6">
        <h2 className="mb-3 text-base font-medium">Fases publicadas</h2>
        <ListaFases fases={datos.fases} />
      </section>

      {(datos.puedeReconsiderar || datos.reconsideraciones.length > 0) && (
        <section className="rounded-lg border border-borde bg-papel p-4 sm:p-6">
          <h2 className="text-base font-medium">Reconsideraciones</h2>
          {datos.reconsideraciones.length > 0 && (
            <ul className="mt-2 divide-y divide-regla">
              {datos.reconsideraciones.map((r) => (
                <li key={r.id} className="py-3 text-sm">
                  <p className="font-medium">
                    {ETAPAS.find((e) => e.id === r.etapa)?.nombre} · {ESTADO_RECONSIDERACION[r.estado]}
                  </p>
                  <p className="mt-1 text-tenue">{r.motivo}</p>
                  {r.respuesta ? (
                    <p className="mt-1">Respuesta: {r.respuesta}</p>
                  ) : (
                    <p className="mt-1 text-xs text-tenue">Plazo de respuesta: {formatoInstante(r.responderAntes)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {datos.puedeReconsiderar && <FormularioReconsideracion onEnviada={setDatos} />}
        </section>
      )}
    </div>
  )
}
