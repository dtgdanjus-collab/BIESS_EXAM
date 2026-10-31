import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Input, PageLoader, SiNo } from '../../../components/ui'
import { useCatalogo } from '../../../hooks/useCatalogo'
import { Seccion, opcional, useFormulario, useGuardarSeccion } from '../components'
import { cargoSchema } from '../schemas'

/** Resultado de la validación contra el Historial Laboral del IESS: ✔ o ✖. */
function ResultadoValidacion({ resultado }) {
  if (!resultado) return null
  return resultado.cumple ? (
    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3" role="status">
      <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">✔</span>
      <p className="text-sm font-semibold text-emerald-900">{resultado.etiqueta}</p>
    </div>
  ) : (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
      <div className="flex items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">✖</span>
        <p className="text-sm font-semibold text-red-900">{resultado.etiqueta}</p>
      </div>
      <p className="mt-2 text-sm text-red-800">{resultado.mensaje}</p>
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
        <legend className="mb-2 text-sm font-medium text-slate-700">
          Cargo al que postula <span className="text-red-600">*</span>
        </legend>
        <div className="space-y-2">
          {sectores.data.map((s) => (
            <label
              key={s.codigo}
              className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                codigo === s.codigo ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                value={s.codigo}
                className="mt-0.5 size-4 shrink-0 accent-brand-700"
                {...register('sector', { onChange: () => setResultado(null) })}
              />
              <span className="text-sm text-slate-800">{s.cargo}</span>
            </label>
          ))}
        </div>
        {errors.sector && (
          <p className="mt-1 text-xs text-red-600" role="alert">
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
