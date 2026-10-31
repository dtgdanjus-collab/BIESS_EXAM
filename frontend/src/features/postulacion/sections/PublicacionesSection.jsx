import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Input, SiNo } from '../../../components/ui'
import { hoyIso } from '../../../utils/fechas'
import { AgregarItem, CampoSelect, ItemLista, Seccion, useFormulario, useGuardarSeccion } from '../components'
import { publicacionesSchema } from '../schemas'

const vacio = { titulo: '', tipo: '', medio: '', fecha: '', relacionada: null }
const TIPOS = [
  { id: 'PUBLICACION', nombre: 'Publicación' },
  { id: 'INVESTIGACION', nombre: 'Investigación' },
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
  const tiene = watch('tienePublicaciones')

  const onSubmit = handleSubmit((v) =>
    peticion.guardar(
      () =>
        postulacionApi.publicaciones({
          tienePublicaciones: v.tienePublicaciones,
          items: v.tienePublicaciones ? v.items.map(({ id, ...p }) => p) : [],
        }),
      setError,
    ),
  )

  return (
    <Seccion
      id="publicaciones"
      numeral="1.7"
      titulo="Publicaciones e investigaciones"
      peticion={peticion}
      onSubmit={onSubmit}
    >
      <Controller
        control={control}
        name="tienePublicaciones"
        render={({ field, fieldState }) => (
          <SiNo
            label="¿Cuenta con publicaciones o investigaciones?"
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
            return (
              <ItemLista key={f.id} titulo={`Publicación ${i + 1}`} onEliminar={() => remove(i)}>
                <Input label="Título" required className="sm:col-span-2" error={e.titulo?.message} {...register(`items.${i}.titulo`)} />
                <CampoSelect control={control} name={`items.${i}.tipo`} label="Tipo" required options={TIPOS} />
                <Input label="Fecha de publicación" type="date" max={hoyIso()} required error={e.fecha?.message} {...register(`items.${i}.fecha`)} />
                <Input
                  label="Medio de publicación (revista, editorial, repositorio…)"
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
                        label="¿Está relacionada con finanzas, mercado de capitales, administración, economía o derecho?"
                        value={field.value}
                        onChange={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </div>
              </ItemLista>
            )
          })}
          <AgregarItem onClick={() => append(vacio)}>Agregar publicación</AgregarItem>
        </div>
      )}
    </Seccion>
  )
}
