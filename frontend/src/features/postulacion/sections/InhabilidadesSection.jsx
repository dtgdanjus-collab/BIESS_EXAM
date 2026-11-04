import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Input, PageLoader, SiNo } from '../../../components/ui'
import { useCatalogo } from '../../../hooks/useCatalogo'
import { formatoFecha, hoyIso } from '../../../utils/fechas'
import { AccionesGuardado, Dato, Seccion, useFormulario, useGuardarSeccion } from '../components'
import { inhabilidadesSchema } from '../schemas'

const detalleVacio = { institucion: '', cargo: '', fechaFin: '', motivo: '' }

function Formulario({ preguntas }) {
  const { postulacion } = useFormulario()
  const peticion = useGuardarSeccion()
  const schema = useMemo(() => inhabilidadesSchema(preguntas), [preguntas])

  const previas = new Map(postulacion.inhabilidades.map((r) => [r.preguntaId, r]))
  const valores = (mapa) => ({
    respuestas: preguntas.map((q) => {
      const r = mapa.get(q.id)
      return { preguntaId: q.id, respuesta: r?.respuesta ?? null, detalle: r?.detalle ? { ...r.detalle, fechaFin: r.detalle.fechaFin ?? '' } : detalleVacio }
    }),
  })
  const { register, control, handleSubmit, watch, setError, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: valores(previas),
  })
  const [editando, setEditando] = useState(postulacion.inhabilidades.length === 0)

  const respuestas = watch('respuestas') ?? []
  const contestadas = respuestas.filter((r) => r.respuesta !== null && r.respuesta !== undefined).length

  const onSubmit = handleSubmit(async (v) => {
    const r = await peticion.guardar(
      () =>
        postulacionApi.inhabilidades(
          v.respuestas.map((r) => {
            const q = preguntas.find((p) => p.id === r.preguntaId)
            const conDetalle = q.requiereDetalle && r.respuesta !== q.respuestaEsperada
            return { preguntaId: r.preguntaId, respuesta: r.respuesta, detalle: conDetalle ? r.detalle : null }
          }),
        ),
      setError,
    )
    if (r.ok) setEditando(false)
  })

  const eliminar = async () => {
    const r = await peticion.guardar(postulacionApi.eliminarInhabilidades)
    if (r.ok) {
      reset(valores(new Map()))
      setEditando(true)
      peticion.reset()
    }
  }

  const base = {
    id: 'inhabilidades',
    numeral: '1.9',
    titulo: 'Inhabilidades',
    descripcion: 'Responda todas las preguntas. Sus respuestas serán verificadas por la Unidad de Talento Humano.',
    peticion,
    onSubmit,
  }

  if (postulacion.inhabilidades.length > 0 && !editando) {
    return (
      <Seccion {...base} ocultarGuardar>
        <ol className="divide-y divide-regla">
          {preguntas.map((q) => {
            const r = previas.get(q.id)
            return (
              <li key={q.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 text-sm first:pt-0">
                <span className="min-w-0 flex-1 basis-64">
                  <span className="mr-1 tabular-nums text-tenue">{q.numeral}</span>
                  {q.texto}
                </span>
                <strong className="font-medium">{r?.respuesta ? 'Sí' : 'No'}</strong>
                {r?.detalle && (
                  <dl className="grid w-full gap-3 rounded-md bg-fondo p-3 sm:grid-cols-2">
                    <Dato etiqueta="Institución" valor={r.detalle.institucion} />
                    <Dato etiqueta="Cargo" valor={r.detalle.cargo} />
                    <Dato etiqueta="Fecha finalización" valor={r.detalle.fechaFin && formatoFecha(r.detalle.fechaFin)} />
                    <Dato etiqueta="Motivo finalización" valor={r.detalle.motivo} />
                  </dl>
                )}
              </li>
            )
          })}
        </ol>
        <AccionesGuardado
          onEditar={() => {
            peticion.reset()
            setEditando(true)
          }}
          onEliminar={eliminar}
          titulo="¿Eliminar sus respuestas?"
          mensaje="Se borrarán las respuestas de esta sección. Deberá responderlas otra vez antes de enviar."
        />
      </Seccion>
    )
  }

  return (
    <Seccion {...base}>
      <div>
        <p className="mb-2 text-sm" aria-live="polite">
          <span className="text-2xl font-medium tabular-nums tracking-tight">{contestadas}</span>
          <span className="text-tenue"> de {preguntas.length} preguntas respondidas</span>
        </p>
        <div aria-hidden="true" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${preguntas.length}, minmax(0, 1fr))` }}>
          {preguntas.map((q, i) => (
            <span
              key={q.id}
              className={`flex h-8 items-center justify-center text-xs font-medium tabular-nums transition-colors ${
                respuestas[i]?.respuesta === null || respuestas[i]?.respuesta === undefined ? 'bg-realce text-tinta' : 'bg-sello text-white'
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>

      <ol className="divide-y divide-regla">
        {preguntas.map((q, i) => {
          const respuesta = watch(`respuestas.${i}.respuesta`)
          const muestraDetalle = q.requiereDetalle && respuesta !== null && respuesta !== q.respuestaEsperada
          const e = errors.respuestas?.[i]?.detalle ?? {}
          return (
            <li key={q.id} className="py-5 first:pt-0 last:pb-0">
              <Controller
                control={control}
                name={`respuestas.${i}.respuesta`}
                render={({ field, fieldState }) => (
                  <SiNo
                    name={`pregunta-${q.id}`}
                    label={
                      <span className="font-normal">
                        <span className="mr-1 tabular-nums text-tenue">{q.numeral}</span>
                        {q.texto}
                      </span>
                    }
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              {muestraDetalle && (
                <div className="mt-3 grid gap-4 rounded-md bg-fondo p-4 sm:grid-cols-2 animate-slide-down">
                  <p className="text-sm font-medium sm:col-span-2">Detalle de la remoción</p>
                  <Input label="Institución" required error={e.institucion?.message} {...register(`respuestas.${i}.detalle.institucion`)} />
                  <Input label="Cargo" error={e.cargo?.message} {...register(`respuestas.${i}.detalle.cargo`)} />
                  <Input
                    label="Fecha finalización"
                    type="date"
                    max={hoyIso()}
                    error={e.fechaFin?.message}
                    {...register(`respuestas.${i}.detalle.fechaFin`)}
                  />
                  <Input label="Motivo finalización" required error={e.motivo?.message} {...register(`respuestas.${i}.detalle.motivo`)} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </Seccion>
  )
}

// 1.9 — Las 13 preguntas vienen del catálogo; el formulario se monta cuando están cargadas.
export function InhabilidadesSection() {
  const preguntas = useCatalogo('inhabilidades')
  if (preguntas.loading) return <PageLoader texto="Cargando preguntas…" />
  if (preguntas.error) return <Alert type="error">No se pudieron cargar las preguntas.</Alert>
  return <Formulario preguntas={preguntas.data} />
}
