import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Input } from '../../../components/ui'
import { useCatalogo } from '../../../hooks/useCatalogo'
import { hoyIso } from '../../../utils/fechas'
import { AgregarItem, CampoDocumento, CampoSelect, ItemLista, Seccion, adjuntoDe, useFormulario, useGuardarSeccion, useItemsPlegables } from '../components'
import { formacionSchema } from '../schemas'

const vacio = { nivelId: '', institucion: '', tipo: '', titulo: '', areaId: '', registroSenescyt: '', fechaRegistro: '', documentoId: null }
const TIPOS = [{ id: 'NACIONAL', nombre: 'Nacional' }, { id: 'EXTRANJERA', nombre: 'Extranjera' }]

// 1.5 — Títulos académicos registrados en la SENESCYT.
export function FormacionSection() {
  const { postulacion } = useFormulario()
  const niveles = useCatalogo('niveles')
  const areas = useCatalogo('areas')
  const peticion = useGuardarSeccion()

  const { register, control, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(formacionSchema),
    defaultValues: {
      items: postulacion.formacion.map((f) => ({ ...f, nivelId: String(f.nivelId), areaId: String(f.areaId) })),
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' }) ?? []
  const plegables = useItemsPlegables(fields, errors.items)

  const onSubmit = handleSubmit(async (v) => {
    const r = await peticion.guardar(
      () => postulacionApi.formacion(v.items.map((f) => ({ ...f, nivelId: Number(f.nivelId), areaId: Number(f.areaId) }))),
      setError,
    )
    if (r.ok) plegables.plegarTodos()
  })

  return (
    <Seccion
      id="formacion"
      numeral="1.5"
      titulo="Formación académica"
      descripcion="Registre sus títulos de tercer y cuarto nivel."
      peticion={peticion}
      onSubmit={onSubmit}
    >
      {errors.items?.root && <Alert type="error">{errors.items.root.message}</Alert>}
      {fields.length === 0 && <p className="text-sm text-tenue">No ha registrado títulos.</p>}
      {fields.map((f, i) => {
        const e = errors.items?.[i] ?? {}
        const actual = items[i] ?? {}
        return (
          <ItemLista
            key={f.id}
            titulo={`Título ${i + 1}`}
            resumen={[actual.titulo, actual.institucion].filter(Boolean).join(' · ')}
            plegado={plegables.plegado(f, i)}
            onEditar={() => plegables.editar(f)}
            onEliminar={() => remove(i)}
          >
            <CampoSelect control={control} name={`items.${i}.nivelId`} label="Nivel de instrucción" required options={niveles.data} loading={niveles.loading} />
            {/* 1.5.1: el resto se despliega al elegir el nivel. Oculto, no desmontado: conserva el PDF subido. */}
            <div className={actual.nivelId ? 'contents' : 'hidden'}>
              <CampoSelect control={control} name={`items.${i}.tipo`} label="Tipo" required options={TIPOS} />
              <Input label="Institución educativa" required className="sm:col-span-2" error={e.institucion?.message} {...register(`items.${i}.institucion`)} />
              <Input label="Título obtenido" required className="sm:col-span-2" error={e.titulo?.message} {...register(`items.${i}.titulo`)} />
              <CampoSelect control={control} name={`items.${i}.areaId`} label="Área de estudios" required options={areas.data} loading={areas.loading} />
              <Input label="Número de registro SENESCYT" required error={e.registroSenescyt?.message} {...register(`items.${i}.registroSenescyt`)} />
              <Input
                label="Fecha de registro SENESCYT"
                type="date"
                max={hoyIso()}
                required
                error={e.fechaRegistro?.message}
                {...register(`items.${i}.fechaRegistro`)}
              />
              <CampoDocumento control={control} name={`items.${i}.documentoId`} categoria="FORMACION" inicial={adjuntoDe(f)} className="sm:col-span-2" />
            </div>
          </ItemLista>
        )
      })}
      <AgregarItem onClick={() => append(vacio)}>Agregar título</AgregarItem>
    </Seccion>
  )
}
