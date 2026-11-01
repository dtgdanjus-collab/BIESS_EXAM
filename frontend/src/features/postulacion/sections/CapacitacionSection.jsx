import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Input } from '../../../components/ui'
import { hoyIso } from '../../../utils/fechas'
import { conFiltro, soloDigitos } from '../../../utils/filtros'
import { AgregarItem, CampoSelect, ItemLista, Seccion, useFormulario, useGuardarSeccion } from '../components'
import { capacitacionesSchema } from '../schemas'

const vacio = { tipo: '', nombre: '', institucion: '', fechaInicio: '', fechaFin: '', horas: '' }
const TIPOS = [
  { id: 'CURSO', nombre: 'Curso' },
  { id: 'SEMINARIO', nombre: 'Seminario' },
  { id: 'TALLER', nombre: 'Taller' },
]

// 1.8 — Capacitación (opcional).
export function CapacitacionSection() {
  const { postulacion } = useFormulario()
  const peticion = useGuardarSeccion()

  const { register, control, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(capacitacionesSchema),
    defaultValues: { items: postulacion.capacitaciones },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const onSubmit = handleSubmit((v) =>
    peticion.guardar(() => postulacionApi.capacitaciones(v.items.map(({ id, ...c }) => c)), setError),
  )

  return (
    <Seccion
      id="capacitacion"
      numeral="1.8"
      titulo="Capacitación"
      descripcion="Cursos, seminarios y talleres relacionados con el cargo. Esta sección es opcional."
      peticion={peticion}
      onSubmit={onSubmit}
    >
      {fields.length === 0 && <p className="text-sm text-slate-500">No ha registrado capacitaciones.</p>}
      {fields.map((f, i) => {
        const e = errors.items?.[i] ?? {}
        return (
          <ItemLista key={f.id} titulo={`Capacitación ${i + 1}`} onEliminar={() => remove(i)}>
            <CampoSelect control={control} name={`items.${i}.tipo`} label="Tipo" required options={TIPOS} />
            <Input label="Horas" inputMode="numeric" placeholder="40" required error={e.horas?.message} {...conFiltro(register(`items.${i}.horas`), soloDigitos(4))} />
            <Input label="Nombre del evento" required className="sm:col-span-2" error={e.nombre?.message} {...register(`items.${i}.nombre`)} />
            <Input label="Institución organizadora" required className="sm:col-span-2" error={e.institucion?.message} {...register(`items.${i}.institucion`)} />
            <Input label="Fecha de inicio" type="date" max={hoyIso()} required error={e.fechaInicio?.message} {...register(`items.${i}.fechaInicio`)} />
            <Input label="Fecha de fin" type="date" max={hoyIso()} required error={e.fechaFin?.message} {...register(`items.${i}.fechaFin`)} />
          </ItemLista>
        )
      })}
      <AgregarItem onClick={() => append(vacio)}>Agregar capacitación</AgregarItem>
    </Seccion>
  )
}
