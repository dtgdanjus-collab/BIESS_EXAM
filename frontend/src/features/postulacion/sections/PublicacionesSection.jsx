import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Input, SiNo } from '../../../components/ui'
import { hoyIso } from '../../../utils/fechas'
import { AgregarItem, CampoDocumento, CampoSelect, ItemLista, Seccion, adjuntoDe, useFormulario, useGuardarSeccion, useItemsPlegables } from '../components'
import { publicacionesSchema } from '../schemas'

const vacio = { titulo: '', tipo: '', medio: '', fecha: '', relacionada: null, documentoId: null }
const TIPOS = [
  { id: 'PUBLICACION', nombre: 'Publicación' },
  { id: 'INVESTIGACION', nombre: 'Trabajo de investigación' },
]

// 1.7 — Publicaciones e investigaciones.
export function PublicacionesSection() {
  const { postulacion } = useFormulario()
  const peticion = useGuardarSeccion()

  const { register, control, handleSubmit, watch, setError, formState: { errors } } = useForm({
    resolver: zodResolver(publicacionesSchema),
    defaultValues: { tienePublicaciones: postulacion.tienePublicaciones, items: postulacion.publicaciones },
  })
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' }) ?? []
  const plegables = useItemsPlegables(fields, errors.items)
  const tiene = watch('tienePublicaciones')

  const onSubmit = handleSubmit(async (v) => {
    const r = await peticion.guardar(
      () =>
        postulacionApi.publicaciones({
          tienePublicaciones: v.tienePublicaciones,
          items: v.tienePublicaciones ? v.items : [],
        }),
      setError,
    )
    if (r.ok) plegables.plegarTodos()
  })

  return (
    <Seccion
      id="publicaciones"
      numeral="1.7"
      titulo="Publicaciones e investigaciones"
      peticion={peticion}
      onSubmit={onSubmit}
      textoGuardar="Guardar información"
    >
      <Controller
        control={control}
        name="tienePublicaciones"
        render={({ field, fieldState }) => (
          <SiNo
            label="¿Cuenta con Publicaciones e Investigaciones académicas?"
            value={field.value}
            onChange={(v) => {
              field.onChange(v)
              if (v && fields.length === 0) append(vacio)
              if (!v) replace([])
            }}
            error={fieldState.error?.message}
          />
        )}
      />

      {tiene && (
        <div className="space-y-3">
          {errors.items?.message && <Alert type="error">{errors.items.message}</Alert>}
          {fields.map((f, i) => {
            const e = errors.items?.[i] ?? {}
            const actual = items[i] ?? {}
            return (
              <ItemLista
                key={f.id}
                titulo={`Publicación ${i + 1}`}
                resumen={actual.titulo}
                aviso={!actual.documentoId && 'Falta el documento de respaldo'}
                plegado={plegables.plegado(f, i)}
                onEditar={() => plegables.editar(f)}
                onEliminar={() => remove(i)}
              >
                <Input label="Título de la publicación o trabajo de investigación" required className="sm:col-span-2" error={e.titulo?.message} {...register(`items.${i}.titulo`)} />
                <CampoSelect control={control} name={`items.${i}.tipo`} label="Tipo" required options={TIPOS} />
                <Input label="Fecha de publicación" type="date" max={hoyIso()} required error={e.fecha?.message} {...register(`items.${i}.fecha`)} />
                <Input
                  label="Medio de publicación"
                  required
                  className="sm:col-span-2"
                  error={e.medio?.message}
                  {...register(`items.${i}.medio`)}
                />
                <div className="sm:col-span-2">
                  <Controller
                    control={control}
                    name={`items.${i}.relacionada`}
                    render={({ field, fieldState }) => (
                      <SiNo
                        label="¿Guarda relación con el campo de su ejercicio o formación profesional?"
                        value={field.value}
                        onChange={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </div>
                <CampoDocumento control={control} name={`items.${i}.documentoId`} categoria="PUBLICACION" inicial={adjuntoDe(f)} required className="sm:col-span-2" />
              </ItemLista>
            )
          })}
          <AgregarItem onClick={() => append(vacio)}>Agregar publicación</AgregarItem>
        </div>
      )}
    </Seccion>
  )
}
