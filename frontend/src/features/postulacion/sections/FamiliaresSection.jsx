import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Input, SiNo } from '../../../components/ui'
import { useCatalogo } from '../../../hooks/useCatalogo'
import { AgregarItem, CampoSelect, ItemLista, Seccion, useFormulario, useGuardarSeccion, useItemsPlegables } from '../components'
import { familiaresSchema } from '../schemas'

const vacio = { nombresApellidos: '', parentescoId: '', institucion: '', area: '', cargo: '' }
const INSTITUCIONES = [{ id: 'IESS', nombre: 'IESS' }, { id: 'BIESS', nombre: 'BIESS' }]

// 1.3 — Información adicional: familiares que laboran en el IESS o el BIESS (lista dinámica).
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
  const items = useWatch({ control, name: 'items' }) ?? []
  const plegables = useItemsPlegables(fields, errors.items)
  const tiene = watch('tieneFamiliares')

  const onSubmit = handleSubmit(async (v) => {
    const r = await peticion.guardar(
      () =>
        postulacionApi.familiares({
          tieneFamiliares: v.tieneFamiliares,
          items: v.tieneFamiliares ? v.items.map((i) => ({ ...i, parentescoId: Number(i.parentescoId) })) : [],
        }),
      setError,
    )
    if (r.ok) plegables.plegarTodos()
  })

  return (
    <Seccion
      id="familiares"
      numeral="1.3"
      titulo="Información adicional"
      peticion={peticion}
      onSubmit={onSubmit}
      textoGuardar="Guardar información"
    >
      <Controller
        control={control}
        name="tieneFamiliares"
        render={({ field, fieldState }) => (
          <SiNo
            label="Tiene familiares dentro del segundo grado de consanguinidad y cuarto de afinidad, trabajando en el IESS o BIESS actualmente"
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
            <ItemLista
              key={f.id}
              titulo={`Familiar ${i + 1}`}
              resumen={[items[i]?.nombresApellidos, items[i]?.institucion].filter(Boolean).join(' · ')}
              plegado={plegables.plegado(f, i)}
              onEditar={() => plegables.editar(f)}
              onEliminar={() => remove(i)}
            >
              <Input
                label="Nombres y apellidos del familiar"
                className="sm:col-span-2"
                required
                error={errors.items?.[i]?.nombresApellidos?.message}
                {...register(`items.${i}.nombresApellidos`)}
              />
              <CampoSelect
                control={control}
                name={`items.${i}.parentescoId`}
                label="Parentesco familiar"
                required
                options={parentescos.data}
                loading={parentescos.loading}
              />
              <CampoSelect
                control={control}
                name={`items.${i}.institucion`}
                label="Institución donde trabaja el familiar"
                required
                options={INSTITUCIONES}
              />
              <Input label="Área donde trabaja el familiar" required error={errors.items?.[i]?.area?.message} {...register(`items.${i}.area`)} />
              <Input label="Cargo" required error={errors.items?.[i]?.cargo?.message} {...register(`items.${i}.cargo`)} />
            </ItemLista>
          ))}
          <AgregarItem onClick={() => append(vacio)}>Agregar familiar</AgregarItem>
        </div>
      )}
    </Seccion>
  )
}
