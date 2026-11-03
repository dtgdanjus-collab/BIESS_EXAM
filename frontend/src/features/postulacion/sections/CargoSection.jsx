import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Icon, Input, PageLoader, SiNo } from '../../../components/ui'
import { useCatalogo } from '../../../hooks/useCatalogo'
import { Seccion, opcional, useFormulario, useGuardarSeccion } from '../components'
import { cargoSchema } from '../schemas'

/** Resultado de la validación contra el Historial Laboral del IESS: ✔ o ✖. */
function ResultadoValidacion({ resultado }) {
  if (!resultado) return null
  return resultado.cumple ? (
    <div className="rounded-md bg-ok-fondo px-3 py-2.5 text-ok-tinta animate-slide-down" role="status">
      <p className="text-xs">Validado en el Historial Laboral</p>
      <p className="text-sm font-medium">{resultado.etiqueta}</p>
    </div>
  ) : (
    <div className="rounded-md bg-mal-fondo px-3 py-2.5 text-mal-tinta animate-shake" role="alert">
      <p className="text-xs">No cumple el requisito</p>
      <p className="text-sm font-medium">{resultado.etiqueta}</p>
      <p className="mt-1 text-sm leading-relaxed">{resultado.mensaje}</p>
    </div>
  )
}

// 1.4 — Cargo al que postula; se valida la calidad de afiliado/jubilado/empleador.
export function CargoSection() {
  const { postulacion } = useFormulario()
  const sectores = useCatalogo('sectores')
  const peticion = useGuardarSeccion()
  const [resultado, setResultado] = useState(null)

  const { register, control, handleSubmit, watch, setError, formState: { errors } } = useForm({
    resolver: zodResolver(cargoSchema),
    defaultValues: {
      sector: postulacion.sectorCodigo ?? '',
      tieneRespaldo: postulacion.tieneRespaldo,
      organizacionNombre: postulacion.organizacionNombre ?? '',
    },
  })

  const codigo = watch('sector')
  const tieneRespaldo = watch('tieneRespaldo')
  const sector = sectores.data.find((s) => s.codigo === codigo)
  const guardado = sectores.data.find((s) => s.codigo === postulacion.sectorCodigo)

  // Si ya hay un cargo guardado y no se cambió, se muestra como validado.
  const mostrado =
    resultado ?? (guardado && codigo === guardado.codigo ? { cumple: true, etiqueta: guardado.etiquetaCumple } : null)

  const onSubmit = handleSubmit(async (v) => {
    const r = await peticion.guardar(
      () =>
        postulacionApi.cargo({
          sector: v.sector,
          tieneRespaldo: v.tieneRespaldo,
          organizacionNombre: v.tieneRespaldo ? opcional(v.organizacionNombre) : null,
        }),
      setError,
    )
    if (r.ok) setResultado({ cumple: true, etiqueta: sector?.etiquetaCumple })
    else if (r.error.status === 422)
      setResultado({ cumple: false, etiqueta: r.error.details?.etiqueta, mensaje: r.error.message })
  })

  if (sectores.loading) return <PageLoader texto="Cargando cargos…" />

  return (
    <Seccion
      id="cargo"
      numeral="1.4"
      titulo="Selección del cargo"
      descripcion="Su calidad de afiliado, jubilado o empleador se verifica en el Historial Laboral del IESS."
      peticion={peticion}
      onSubmit={onSubmit}
      mostrarError={peticion.error?.status !== 422}
      pie={<ResultadoValidacion resultado={mostrado} />}
    >
      {sectores.error && <Alert type="error">No se pudo cargar el catálogo de cargos.</Alert>}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Cargo al que postula <span className="text-mal">*</span>
        </legend>
        <div className="grid gap-2 lg:grid-cols-3">
          {sectores.data.map((s) => {
            const activo = codigo === s.codigo
            return (
              <label
                key={s.codigo}
                className={`flex cursor-pointer flex-col gap-3 rounded-md border p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-tinta ${
                  activo ? 'border-tinta bg-tinta text-white' : 'border-borde bg-papel hover:border-tinta'
                }`}
              >
                <input
                  type="radio"
                  value={s.codigo}
                  className="sr-only"
                  {...register('sector', { onChange: () => setResultado(null) })}
                />
                <span className="flex items-start justify-between gap-2">
                  <span className="text-lg font-medium capitalize leading-tight">{s.codigo.toLowerCase()}</span>
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${activo ? 'border-white bg-white text-tinta' : 'border-control'}`} aria-hidden="true">
                    {activo && <Icon name="check" className="size-3.5 animate-pop" strokeWidth={3} />}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mt-0.5 block text-sm leading-relaxed opacity-80">{s.cargo}</span>
                </span>
                              </label>
            )
          })}
        </div>
        {errors.sector && (
          <p className="mt-1 text-xs text-mal" role="alert">
            {errors.sector.message}
          </p>
        )}
      </fieldset>

      {sector && (
        <Controller
          control={control}
          name="tieneRespaldo"
          render={({ field, fieldState }) => (
            <SiNo
              label={sector.preguntaRespaldo}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      )}

      {sector && tieneRespaldo && (
        <Input
          label="Nombre de la organización que lo respalda"
          required
          error={errors.organizacionNombre?.message}
          {...register('organizacionNombre')}
        />
      )}
    </Seccion>
  )
}
