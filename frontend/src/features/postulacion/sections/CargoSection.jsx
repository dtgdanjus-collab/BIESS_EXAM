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
    <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-4 animate-fade-in" role="status">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
        <Icon name="check" className="size-5" strokeWidth={3} />
      </span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Validado en el Historial Laboral</p>
        <p className="text-sm font-bold text-emerald-900">{resultado.etiqueta}</p>
      </div>
    </div>
  ) : (
    <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-white px-4 py-4 animate-fade-in" role="alert">
      <div className="flex items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30">
          <Icon name="x" className="size-5" strokeWidth={3} />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-500">No cumple el requisito</p>
          <p className="text-sm font-bold text-red-900">{resultado.etiqueta}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-red-800">{resultado.mensaje}</p>
    </div>
  )
}

const ICONO_SECTOR = { AFILIADOS: 'users', JUBILADOS: 'clock', EMPLEADORES: 'building' }

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
        <legend className="mb-3 text-sm font-semibold text-slate-800">
          Cargo al que postula <span className="text-red-500">*</span>
        </legend>
        <div className="grid gap-3">
          {sectores.data.map((s) => {
            const activo = codigo === s.codigo
            return (
              <label
                key={s.codigo}
                className={`group relative flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all sm:p-5 ${
                  activo
                    ? 'border-brand-500 bg-gradient-to-br from-brand-50 to-white shadow-card ring-2 ring-brand-500/20'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-card'
                }`}
              >
                <input
                  type="radio"
                  value={s.codigo}
                  className="sr-only"
                  {...register('sector', { onChange: () => setResultado(null) })}
                />
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    activo ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:text-brand-700'
                  }`}
                >
                  <Icon name={ICONO_SECTOR[s.codigo] ?? 'briefcase'} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold capitalize text-slate-900">{s.codigo.toLowerCase()}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{s.cargo}</span>
                </span>
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    activo ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'
                  }`}
                  aria-hidden="true"
                >
                  {activo && <Icon name="check" className="size-3" strokeWidth={3.5} />}
                </span>
              </label>
            )
          })}
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
