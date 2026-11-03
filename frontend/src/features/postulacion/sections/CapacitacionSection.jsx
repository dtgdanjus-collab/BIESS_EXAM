import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Input } from '../../../components/ui'
import { hoyIso } from '../../../utils/fechas'
import { conFiltro, soloDigitos } from '../../../utils/filtros'
import { AgregarItem, CampoDocumento, CampoSelect, ItemLista, Seccion, adjuntoDe, useFormulario, useGuardarSeccion, useItemsPlegables } from '../components'
import { capacitacionesSchema } from '../schemas'

const vacio = { tipo: '', nombre: '', institucion: '', fechaInicio: '', fechaFin: '', horas: '', documentoId: null }
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
  const items = useWatch({ control, name: 'items' }) ?? []
  const plegables = useItemsPlegables(fields, errors.items)

  const onSubmit = handleSubmit(async (v) => {
    const r = await peticion.guardar(() => postulacionApi.capacitaciones(v.items), setError)
    if (r.ok) plegables.plegarTodos()
  })

  return (
    <Seccion
      id="capacitacion"
      numeral="1.8"
      titulo="Capacitación"
      descripcion="Cursos, seminarios y talleres relacionados con el cargo. Esta sección es opcional."
      peticion={peticion}
      onSubmit={onSubmit}
      textoGuardar="Guardar información"
    >
      {fields.length === 0 && <p className="text-sm text-tenue">No ha registrado capacitaciones.</p>}
      {fields.map((f, i) => {
        const e = errors.items?.[i] ?? {}
        const actual = items[i] ?? {}
        return (
          <ItemLista
            key={f.id}
            titulo={`Capacitación ${i + 1}`}
            resumen={[actual.nombre, actual.institucion].filter(Boolean).join(' · ')}
            plegado={plegables.plegado(f, i)}
            onEditar={() => plegables.editar(f)}
            onEliminar={() => remove(i)}
          >
            <CampoSelect control={control} name={`items.${i}.tipo`} label="Tipo de evento" required options={TIPOS} />
            <Input label="Número de horas del evento" inputMode="numeric" placeholder="40" required error={e.horas?.message} {...conFiltro(register(`items.${i}.horas`), soloDigitos(4))} />
            <Input label="Nombre del evento" required className="sm:col-span-2" error={e.nombre?.message} {...register(`items.${i}.nombre`)} />
            <Input label="Institución" required className="sm:col-span-2" error={e.institucion?.message} {...register(`items.${i}.institucion`)} />
            <Input label="Fecha inicio" type="date" max={hoyIso()} required error={e.fechaInicio?.message} {...register(`items.${i}.fechaInicio`)} />
            <Input label="Fecha fin" type="date" max={hoyIso()} required error={e.fechaFin?.message} {...register(`items.${i}.fechaFin`)} />
            <CampoDocumento control={control} name={`items.${i}.documentoId`} categoria="CAPACITACION" inicial={adjuntoDe(f)} className="sm:col-span-2" />
          </ItemLista>
        )
      })}
      <AgregarItem onClick={() => append(vacio)}>Agregar capacitación</AgregarItem>
    </Seccion>
  )
}
