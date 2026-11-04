import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { evaluacionApi } from '../../api/postulacion'
import { Alert, Button, ErrorAlert, Modal, PageLoader } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useTituloPagina } from '../../hooks/useTituloPagina'
import { guardarArchivo } from '../../utils/descargas'
import { formatoInstante } from './componentes'

const reloj = (s) => {
  const total = Math.max(0, s)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const seg = total % 60
  const dos = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dos(m)}:${dos(seg)}` : `${dos(m)}:${dos(seg)}`
}

/** 1.3.2: bloquea «Atrás», copiar, pegar y el menú contextual mientras dura el examen. */
function useBloqueosExamen(activo) {
  useEffect(() => {
    if (!activo) return undefined
    const impedir = (e) => e.preventDefault()
    const alRetroceder = () => window.history.pushState(null, '', window.location.href)
    const alSalir = (e) => e.preventDefault()
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', alRetroceder)
    window.addEventListener('beforeunload', alSalir)
    for (const evento of ['copy', 'cut', 'paste', 'contextmenu']) document.addEventListener(evento, impedir)
    return () => {
      window.removeEventListener('popstate', alRetroceder)
      window.removeEventListener('beforeunload', alSalir)
      for (const evento of ['copy', 'cut', 'paste', 'contextmenu']) document.removeEventListener(evento, impedir)
    }
  }, [activo])
}

function Marco({ children, cabecera }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-4 bg-noche px-4 py-2 text-white sm:px-6">
        <p className="text-sm font-medium">Evaluación técnica · Directorio del BIESS</p>
        {cabecera}
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  )
}

function Examen({ estado, onCambio, peticion }) {
  const [opcion, setOpcion] = useState(null)
  const [segundos, setSegundos] = useState(estado.segundosRestantes)
  const [confirmar, setConfirmar] = useState(false)
  const fin = useRef(Date.now() + estado.segundosRestantes * 1000)
  const cerrando = useRef(false)
  const pregunta = estado.pregunta

  useBloqueosExamen(true)

  const finalizar = useCallback(async () => {
    if (cerrando.current) return
    cerrando.current = true
    const r = await peticion.run(evaluacionApi.finalizar)
    if (r.ok) onCambio(r.data)
    else cerrando.current = false
  }, [onCambio, peticion.run])

  // El servidor lleva la cuenta real: este reloj solo la muestra y, en 00:00, pide el cierre.
  useEffect(() => {
    fin.current = Date.now() + estado.segundosRestantes * 1000
    setSegundos(estado.segundosRestantes)
  }, [estado.segundosRestantes])
  useEffect(() => {
    const t = setInterval(() => {
      const quedan = Math.ceil((fin.current - Date.now()) / 1000)
      setSegundos(quedan)
      if (quedan <= 0) finalizar()
    }, 500)
    return () => clearInterval(t)
  }, [finalizar])

  const responder = async () => {
    const r = await peticion.run(() => evaluacionApi.responder({ orden: pregunta.orden, opcion }))
    if (r.ok) {
      setOpcion(null)
      onCambio(r.data)
    }
  }

  return (
    <Marco
      cabecera={
        <p className={`font-mono text-2xl tabular-nums ${segundos <= 60 ? 'text-[#ff8a80]' : ''}`} role="timer" aria-label="Tiempo restante">
          {reloj(segundos)}
        </p>
      }
    >
      <div className="select-none rounded-lg border border-borde bg-papel p-5 sm:p-8">
        {pregunta ? (
          <>
            <p className="text-xs tabular-nums text-tenue">
              Pregunta {pregunta.orden} de {estado.total}
            </p>
            <h1 className="mt-2 text-lg font-medium leading-snug">{pregunta.enunciado}</h1>
            <div className="mt-5 space-y-2" role="radiogroup" aria-label="Opciones">
              {pregunta.opciones.map((texto, i) => (
                <label
                  key={i}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-tinta ${
                    opcion === i ? 'border-tinta bg-fondo' : 'border-borde hover:border-tinta'
                  }`}
                >
                  <input type="radio" name="opcion" className="size-4 accent-tinta" checked={opcion === i} onChange={() => setOpcion(i)} />
                  {texto}
                </label>
              ))}
            </div>
            <ErrorAlert error={peticion.error} className="mt-4" />
            <div className="mt-6 flex justify-end">
              <Button onClick={responder} disabled={opcion === null} loading={peticion.loading}>
                {pregunta.orden < estado.total ? 'Guardar y continuar' : 'Guardar respuesta'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-lg font-medium">Respondió todas las preguntas</h1>
            <p className="mt-2 text-sm text-tenue">Pulse «Finalizar y Calificar» para conocer su resultado.</p>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant={pregunta ? 'secondary' : 'primary'} onClick={() => setConfirmar(true)} disabled={peticion.loading}>
          Finalizar y Calificar
        </Button>
      </div>

      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="¿Finalizar la evaluación?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmar(false)}>
              Seguir respondiendo
            </Button>
            <Button
              onClick={() => {
                setConfirmar(false)
                finalizar()
              }}
            >
              Sí, finalizar
            </Button>
          </>
        }
      >
        Lleva {estado.respondidas} de {estado.total} preguntas respondidas. Las que no respondió se calificarán como incorrectas.
      </Modal>
    </Marco>
  )
}

function Resultado({ estado }) {
  const descarga = useAsync()
  const bajar = async () => {
    const r = await descarga.run(evaluacionApi.reporte)
    if (r.ok) guardarArchivo(r.data, 'evaluacion.pdf')
  }
  return (
    <Marco>
      <div className="rounded-lg border border-borde bg-papel p-5 sm:p-8">
        <h1 className="text-lg font-medium">Evaluación finalizada</h1>
        {estado.forzado && <p className="mt-1 text-sm text-tenue">Se cerró al terminar el tiempo, con las respuestas guardadas hasta ese momento.</p>}
        <p className="mt-6 text-xs text-tenue">Calificación</p>
        <p className="text-[40px] font-medium leading-none tabular-nums">
          {estado.nota?.toFixed(2)} <span className="text-base text-tenue">/ 100</span>
        </p>
        <p className="mt-2 text-sm">
          {estado.correctas} de {estado.total} respuestas correctas.
        </p>
        <ErrorAlert error={descarga.error} className="mt-4" />
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={bajar} loading={descarga.loading}>
            Descargar reporte en PDF
          </Button>
          <Link to="/concurso" className="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium underline-offset-4 hover:underline">
            Volver al concurso
          </Link>
        </div>
      </div>
    </Marco>
  )
}

/** EF-14: solo existe para quien superó los méritos; a los demás el backend les responde 404. */
export function EvaluacionPage() {
  useTituloPagina('Evaluación técnica')
  const carga = useAsync()
  const accion = useAsync()
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    carga.run(evaluacionApi.estado).then((r) => r.ok && setEstado(r.data))
  }, [carga.run])

  if (carga.loading && !estado) return <PageLoader texto="Cargando la evaluación…" />
  if (!estado) {
    return (
      <Marco>
        <Alert type="info" title="La evaluación no está disponible">
          Solo pueden rendirla quienes superaron la fase de méritos.{' '}
          <Link to="/concurso" className="underline underline-offset-4">
            Ver el avance del concurso
          </Link>
        </Alert>
      </Marco>
    )
  }
  if (estado.estado === 'FINALIZADA') return <Resultado estado={estado} />
  if (estado.estado === 'EN_CURSO') return <Examen estado={estado} onCambio={setEstado} peticion={accion} />

  const iniciar = async () => {
    const r = await accion.run(evaluacionApi.iniciar)
    if (r.ok) setEstado(r.data)
  }
  return (
    <Marco>
      <div className="rounded-lg border border-borde bg-papel p-5 sm:p-8">
        <h1 className="text-xl font-medium tracking-tight">Evaluación técnica</h1>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>
            {estado.numPreguntas} preguntas de opción múltiple, una por una, en {estado.duracionMinutos} minutos.
          </li>
          <li>Cada postulante recibe preguntas al azar y en distinto orden.</li>
          <li>Una respuesta guardada no se puede cambiar.</li>
          <li>Al llegar a 00:00 el examen se cierra y se califican las respuestas guardadas hasta ese segundo.</li>
          <li>Durante el examen no se puede volver atrás, copiar ni pegar.</li>
        </ul>
        {estado.habilitada ? (
          <>
            <ErrorAlert error={accion.error} className="mt-4" />
            <Button onClick={iniciar} loading={accion.loading} className="mt-6">
              Iniciar Evaluación
            </Button>
          </>
        ) : (
          <Alert type="warning" className="mt-6" title="La evaluación aún no está habilitada">
            {estado.inicio ? `Se habilita el ${formatoInstante(estado.inicio)}.` : 'Talento Humano comunicará la fecha y la hora.'}
          </Alert>
        )}
      </div>
    </Marco>
  )
}
