import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Icon, Input, Textarea } from '../../../components/ui'
import { useCatalogo } from '../../../hooks/useCatalogo'
import { calcularDuracion, hoyIso, sumarDuraciones, textoDuracion } from '../../../utils/fechas'
import { AgregarItem, CampoSelect, ItemLista, Seccion, useFormulario, useGuardarSeccion } from '../components'
import { experienciaSchema } from '../schemas'

const vacio = { tipo: '', cargo: '', institucion: '', fechaInicio: '', fechaFin: '', areaId: '', descripcion: '' }
const TIPOS = [
  { id: 'GENERAL', nombre: 'Experiencia general' },
  { id: 'DIRECCION', nombre: 'Experiencia en dirección' },
]

/** Totales calculados en vivo (mismo algoritmo que el backend). */
function Totales({ items }) {
  const dur = items.map((it) => ({ tipo: it.tipo, d: calcularDuracion(it.fechaInicio, it.fechaFin) }))
  const general = sumarDuraciones(dur.filter((x) => x.tipo === 'GENERAL').map((x) => x.d))
  const direccion = sumarDuraciones(dur.filter((x) => x.tipo === 'DIRECCION').map((x) => x.d))
  const total = sumarDuraciones(dur.map((x) => x.d))
  const fila = (etiqueta, d, fuerte) => (
    <div className={`rounded-xl px-4 py-3 ${fuerte ? 'bg-gold-300 text-brand-950' : 'bg-white/10 ring-1 ring-inset ring-white/10'}`}>
      <dt className={`text-[11px] font-bold uppercase tracking-wider ${fuerte ? 'text-brand-900/70' : 'text-brand-100/70'}`}>
        {etiqueta}
      </dt>
      <dd className="mt-1 text-sm font-bold tabular-nums">{textoDuracion(d)}</dd>
    </div>
  )
  return (
    <div className="relative overflow-hidden rounded-2xl bg-brand-950 p-5 text-white" aria-live="polite">
      <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-30" />
      <p className="relative mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-gold-300">
        <Icon name="clock" className="size-4" />
        Experiencia acumulada
      </p>
      <dl className="relative grid gap-2.5 sm:grid-cols-3">
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
      items: postulacion.experiencia.length
        ? postulacion.experiencia.map(({ duracion, ...e }) => ({ ...e, areaId: String(e.areaId) }))
        : [vacio],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' }) ?? []

  const onSubmit = handleSubmit((v) =>
    peticion.guardar(
      () => postulacionApi.experiencia(v.items.map(({ id, ...e }) => ({ ...e, areaId: Number(e.areaId) }))),
      setError,
    ),
  )

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
      {fields.map((f, i) => {
        const e = errors.items?.[i] ?? {}
        const actual = items[i] ?? {}
        const duracion = calcularDuracion(actual.fechaInicio, actual.fechaFin)
        return (
          <ItemLista key={f.id} titulo={`Experiencia ${i + 1}`} onEliminar={fields.length > 1 ? () => remove(i) : null}>
            <CampoSelect control={control} name={`items.${i}.tipo`} label="Tipo de experiencia" required options={TIPOS} />
            <CampoSelect control={control} name={`items.${i}.areaId`} label="Área" required options={areas.data} loading={areas.loading} />
            <Input label="Cargo" required error={e.cargo?.message} {...register(`items.${i}.cargo`)} />
            <Input label="Institución / empresa" required error={e.institucion?.message} {...register(`items.${i}.institucion`)} />
            <Input label="Fecha de inicio" type="date" max={hoyIso()} required error={e.fechaInicio?.message} {...register(`items.${i}.fechaInicio`)} />
            <Input label="Fecha de fin" type="date" max={hoyIso()} required error={e.fechaFin?.message} {...register(`items.${i}.fechaFin`)} />
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-sm ring-1 ring-inset ring-brand-100 sm:col-span-2">
              <Icon name="clock" className="size-4 text-brand-600" />
              <span className="text-slate-500">Tiempo: </span>
              <span className="font-semibold text-brand-800">{duracion ? textoDuracion(duracion) : '—'}</span>
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
          </ItemLista>
        )
      })}
      <AgregarItem onClick={() => append(vacio)}>Agregar experiencia</AgregarItem>
      <Totales items={items} />
    </Seccion>
  )
}
