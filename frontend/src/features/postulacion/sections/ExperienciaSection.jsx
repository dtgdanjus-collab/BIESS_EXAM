import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Input, Textarea } from '../../../components/ui'
import { useCatalogo } from '../../../hooks/useCatalogo'
import { calcularDuracion, hoyIso, sumarDuraciones, textoDuracion } from '../../../utils/fechas'
import { AgregarItem, CampoDocumento, CampoSelect, ItemLista, Seccion, adjuntoDe, useFormulario, useGuardarSeccion, useItemsPlegables } from '../components'
import { experienciaSchema } from '../schemas'

const vacio = { tipo: '', cargo: '', institucion: '', fechaInicio: '', fechaFin: '', areaId: '', descripcion: '', documentoId: null }
const TIPOS = [
  { id: 'GENERAL', nombre: 'General' },
  { id: 'DIRECCION', nombre: 'Dirección' },
]

const anioDe = (iso) => Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12

/** La carrera en una línea de tiempo: cada registro con fechas es una barra. */
function LineaTiempo({ items }) {
  const filas = items
    .map((it, i) => ({ ...it, i }))
    .filter((it) => it.fechaInicio && it.fechaFin && it.fechaFin >= it.fechaInicio)
  if (filas.length === 0) {
    return <p className="rounded-md border border-dashed border-control px-3 py-3 text-sm text-tenue">Su línea de tiempo aparecerá al escribir las fechas.</p>
  }
  const desde = Math.floor(Math.min(...filas.map((f) => anioDe(f.fechaInicio))))
  const hasta = Math.ceil(Math.max(...filas.map((f) => anioDe(f.fechaFin)) )) || desde + 1
  const tramo = Math.max(hasta - desde, 1)
  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm font-medium">
        Línea de tiempo
        <span className="flex gap-3 text-xs font-normal text-tenue">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 bg-tinta" aria-hidden="true" />General</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 bg-sello" aria-hidden="true" />En dirección</span>
        </span>
      </figcaption>
      <div className="space-y-1.5 rounded-md bg-fondo p-3">
        {filas.map((f) => (
          <div key={f.i}>
            <p className="mb-0.5 truncate text-xs">{f.cargo || `Registro ${f.i + 1}`}</p>
            <div className="relative h-4 bg-realce">
              <span
                className={`absolute inset-y-0 min-w-1 transition-[left,width] duration-300 ${f.tipo === 'DIRECCION' ? 'bg-sello' : 'bg-tinta'}`}
                style={{ left: `${((anioDe(f.fechaInicio) - desde) / tramo) * 100}%`, width: `${((anioDe(f.fechaFin) - anioDe(f.fechaInicio)) / tramo) * 100}%` }}
              />
            </div>
          </div>
        ))}
        <p className="flex justify-between pt-0.5 text-xs tabular-nums text-tenue">
          <span>{desde}</span>
          <span>{hasta}</span>
        </p>
      </div>
    </figure>
  )
}

/** Totales calculados en vivo (mismo algoritmo que el backend). */
function Totales({ items }) {
  const dur = items.map((it) => ({ tipo: it.tipo, d: calcularDuracion(it.fechaInicio, it.fechaFin) }))
  const general = sumarDuraciones(dur.filter((x) => x.tipo === 'GENERAL').map((x) => x.d))
  const direccion = sumarDuraciones(dur.filter((x) => x.tipo === 'DIRECCION').map((x) => x.d))
  const total = sumarDuraciones(dur.map((x) => x.d))
  const fila = (etiqueta, d, fuerte) => (
    <div className={`px-4 py-3 ${fuerte ? 'bg-noche text-white' : ''}`}>
      <dt className={`text-xs ${fuerte ? 'text-noche-tenue' : 'text-tenue'}`}>{etiqueta}</dt>
      <dd className={`mt-0.5 text-sm tabular-nums ${fuerte ? 'text-base font-medium' : ''}`}>{textoDuracion(d)}</dd>
    </div>
  )
  return (
    <div aria-live="polite">
      <p className="mb-2 text-sm font-medium">Experiencia acumulada</p>
      <dl className="grid divide-y divide-regla overflow-hidden rounded-md border border-borde sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {fila('General', general)}
        {fila('En dirección', direccion)}
        {fila('Total', total, true)}
      </dl>
    </div>
  )
}

// 1.6 — Experiencia profesional con cálculo de años, meses y días.
export function ExperienciaSection() {
  const { postulacion } = useFormulario()
  const areas = useCatalogo('areas')
  const peticion = useGuardarSeccion()

  const { register, control, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(experienciaSchema),
    defaultValues: {
      items: postulacion.experiencia.map(({ duracion, ...e }) => ({ ...e, areaId: String(e.areaId) })),
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' }) ?? []
  const plegables = useItemsPlegables(fields, errors.items)

  const onSubmit = handleSubmit(async (v) => {
    const r = await peticion.guardar(
      () => postulacionApi.experiencia(v.items.map((e) => ({ ...e, areaId: Number(e.areaId) }))),
      setError,
    )
    if (r.ok) plegables.plegarTodos()
  })

  return (
    <Seccion
      id="experiencia"
      numeral="1.6"
      titulo="Experiencia profesional"
      descripcion="El tiempo se calcula automáticamente incluyendo el día de inicio y el de fin."
      peticion={peticion}
      onSubmit={onSubmit}
    >
      {errors.items?.root && <Alert type="error">{errors.items.root.message}</Alert>}
      {fields.length === 0 && <p className="text-sm text-tenue">No ha registrado experiencia.</p>}
      {fields.map((f, i) => {
        const e = errors.items?.[i] ?? {}
        const actual = items[i] ?? {}
        const duracion = calcularDuracion(actual.fechaInicio, actual.fechaFin)
        return (
          <ItemLista
            key={f.id}
            titulo={`Experiencia ${i + 1}`}
            resumen={[actual.cargo, actual.institucion].filter(Boolean).join(' · ')}
            aviso={!actual.documentoId && 'Falta el documento de respaldo'}
            plegado={plegables.plegado(f, i)}
            onEditar={() => plegables.editar(f)}
            onEliminar={() => remove(i)}
          >
            <CampoSelect control={control} name={`items.${i}.tipo`} label="Tipo de experiencia" required options={TIPOS} />
            <CampoSelect control={control} name={`items.${i}.areaId`} label="Actividades relacionadas a" required options={areas.data} loading={areas.loading} />
            <Input label="Cargo o puesto" required error={e.cargo?.message} {...register(`items.${i}.cargo`)} />
            <Input label="Institución o empresa" required error={e.institucion?.message} {...register(`items.${i}.institucion`)} />
            <Input label="Fecha inicio" type="date" max={hoyIso()} required error={e.fechaInicio?.message} {...register(`items.${i}.fechaInicio`)} />
            <Input label="Fecha finalización" type="date" max={hoyIso()} required error={e.fechaFin?.message} {...register(`items.${i}.fechaFin`)} />
            <p className="text-sm sm:col-span-2">
              <span className="text-tenue">Tiempo: </span>
              <span className="font-medium tabular-nums">{duracion ? textoDuracion(duracion) : '—'}</span>
            </p>
            <Textarea
              label="Descripción de funciones"
              required
              maxLength={1000}
              className="sm:col-span-2"
              value={actual.descripcion ?? ''}
              error={e.descripcion?.message}
              {...register(`items.${i}.descripcion`)}
            />
            <CampoDocumento control={control} name={`items.${i}.documentoId`} categoria="EXPERIENCIA" inicial={adjuntoDe(f)} required className="sm:col-span-2" />
          </ItemLista>
        )
      })}
      <AgregarItem onClick={() => append(vacio)}>Agregar experiencia</AgregarItem>
      <LineaTiempo items={items} />
      <Totales items={items} />
    </Seccion>
  )
}
