import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Input, SiNo } from '../../../components/ui'
import { useCatalogo } from '../../../hooks/useCatalogo'
import { AgregarItem, CampoSelect, ItemLista, Seccion, useFormulario, useGuardarSeccion } from '../components'
import { familiaresSchema } from '../schemas'

const vacio = { nombresApellidos: '', parentescoId: '', institucion: '', area: '', cargo: '' }
const INSTITUCIONES = [{ id: 'IESS', nombre: 'IESS' }, { id: 'BIESS', nombre: 'BIESS' }]

// 1.3 — Familiares que laboran en el IESS o el BIESS (lista dinámica).
export function FamiliaresSection() {
  const { postulacion } = useFormulario()
  const parentescos = useCatalogo('parentescos')
  const peticion = useGuardarSeccion()

  const { register, control, handleSubmit, watch, setError, formState: { errors } } = useForm({
    resolver: zodResolver(familiaresSchema),
    defaultValues: {
      tieneFamiliares: postulacion.tieneFamiliares,
      items: postulacion.familiares.map((f) => ({ ...f, parentescoId: String(f.parentescoId) })),
    },
  })
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })
  const tiene = watch('tieneFamiliares')

  const onSubmit = handleSubmit((v) =>
    peticion.guardar(
      () =>
        postulacionApi.familiares({
          tieneFamiliares: v.tieneFamiliares,
          items: v.tieneFamiliares ? v.items.map((i) => ({ ...i, parentescoId: Number(i.parentescoId) })) : [],
        }),
      setError,
    ),
  )

  return (
    <Seccion
      id="familiares"
      numeral="1.3"
      titulo="Familiares que laboran en el IESS o BIESS"
      descripcion="Hasta el cuarto grado de consanguinidad y segundo de afinidad, cónyuge o conviviente."
      peticion={peticion}
      onSubmit={onSubmit}
    >
      <Controller
        control={control}
        name="tieneFamiliares"
        render={({ field, fieldState }) => (
          <SiNo
            label="¿Tiene familiares que laboren actualmente en el IESS o en el BIESS?"
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
          {errors.items?.root?.message || errors.items?.message ? (
            <Alert type="error">{errors.items?.root?.message ?? errors.items?.message}</Alert>
          ) : null}
          {fields.map((f, i) => (
            <ItemLista key={f.id} titulo={`Familiar ${i + 1}`} onEliminar={() => remove(i)}>
              <Input
                label="Nombres y apellidos"
                className="sm:col-span-2"
                required
                error={errors.items?.[i]?.nombresApellidos?.message}
                {...register(`items.${i}.nombresApellidos`)}
              />
              <CampoSelect
                control={control}
                name={`items.${i}.parentescoId`}
                label="Parentesco"
                required
                options={parentescos.data}
                loading={parentescos.loading}
              />
              <CampoSelect
                control={control}
                name={`items.${i}.institucion`}
                label="Institución"
                required
                options={INSTITUCIONES}
              />
              <Input label="Área / dependencia" required error={errors.items?.[i]?.area?.message} {...register(`items.${i}.area`)} />
              <Input label="Cargo" required error={errors.items?.[i]?.cargo?.message} {...register(`items.${i}.cargo`)} />
            </ItemLista>
          ))}
          <AgregarItem onClick={() => append(vacio)}>Agregar familiar</AgregarItem>
        </div>
      )}
    </Seccion>
  )
}
