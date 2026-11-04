import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, ErrorAlert, Icon, Input, PageLoader, SiNo, Spinner } from '../../../components/ui'
import { useAsync } from '../../../hooks/useAsync'
import { useCatalogo } from '../../../hooks/useCatalogo'
import { useAuthStore } from '../../../store/authStore'
import { AccionesGuardado, CampoDocumento, Dato, EnlaceDocumento, Seccion, opcional, useFormulario, useGuardarSeccion } from '../components'
import { cargoSchema } from '../schemas'

const SEGUNDOS_CIERRE = 15

/** 1.4.x.2: tras leer el rechazo, «el sistema se cierra automáticamente». */
function CierreAutomatico() {
  const logout = useAuthStore((s) => s.logout)
  const [quedan, setQuedan] = useState(SEGUNDOS_CIERRE)

  useEffect(() => {
    const t = setInterval(() => setQuedan((n) => n - 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (quedan > 0) return
    logout()
    // Como al expirar la sesión: una redirección de la ruta protegida perdería el aviso.
    window.location.assign('/login?rechazo=1')
  }, [quedan, logout])

  return <p className="mt-2 text-xs tabular-nums">El sistema se cerrará en {Math.max(quedan, 0)} segundos.</p>
}

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
      <CierreAutomatico />
    </div>
  )
}

const valoresDe = (p) => ({
  sector: p.sectorCodigo ?? '',
  tieneRespaldo: p.tieneRespaldo,
  organizacionNombre: p.organizacionNombre ?? '',
  organizacionDocumentoId: p.organizacionDocumento?.id ?? null,
})

// 1.4 — Cargo al que postula: al elegirlo se valida la calidad de afiliado/jubilado/empleador
// y solo si la acredita se despliega la pregunta del respaldo.
export function CargoSection() {
  const { postulacion } = useFormulario()
  const sectores = useCatalogo('sectores')
  const peticion = useGuardarSeccion()
  const validacion = useAsync()
  const [resultado, setResultado] = useState(null)
  const [editando, setEditando] = useState(!postulacion.sectorCodigo)
  const ultimaConsulta = useRef(null)

  const { register, control, handleSubmit, watch, setError, reset, formState: { errors } } = useForm({
    resolver: zodResolver(cargoSchema),
    defaultValues: valoresDe(postulacion),
  })

  const codigo = watch('sector')
  const tieneRespaldo = watch('tieneRespaldo')
  const sector = sectores.data.find((s) => s.codigo === codigo)
  const guardado = sectores.data.find((s) => s.codigo === postulacion.sectorCodigo)

  // Si ya hay un cargo guardado y no se cambió, se muestra como validado.
  const mostrado =
    resultado ?? (guardado && codigo === guardado.codigo ? { cumple: true, etiqueta: guardado.etiquetaCumple } : null)

  const validar = async (elegido) => {
    setResultado(null)
    ultimaConsulta.current = elegido
    const r = await validacion.run(() => postulacionApi.validarCargo(elegido))
    if (r.ok && ultimaConsulta.current === elegido) setResultado(r.data)
  }

  const onSubmit = handleSubmit(async (v) => {
    const r = await peticion.guardar(
      () =>
        postulacionApi.cargo({
          sector: v.sector,
          tieneRespaldo: v.tieneRespaldo,
          organizacionNombre: v.tieneRespaldo ? opcional(v.organizacionNombre) : null,
          organizacionDocumentoId: v.tieneRespaldo ? v.organizacionDocumentoId : null,
        }),
      setError,
    )
    if (r.ok) {
      reset(valoresDe(r.data))
      setResultado(null)
      setEditando(false)
    } else if (r.error.status === 422) {
      setResultado({ cumple: false, etiqueta: r.error.details?.etiqueta, mensaje: r.error.message })
    }
  })

  const eliminar = async () => {
    const r = await peticion.guardar(postulacionApi.eliminarCargo)
    if (r.ok) {
      reset(valoresDe(r.data))
      setResultado(null)
      setEditando(true)
      peticion.reset()
    }
  }

  if (sectores.loading) return <PageLoader texto="Cargando cargos…" />

  const base = {
    id: 'cargo',
    numeral: '1.4',
    titulo: 'Selección del cargo al que postula',
    descripcion: 'Su calidad de afiliado, jubilado o empleador se verifica en el Historial Laboral del IESS.',
    peticion,
    onSubmit,
    mostrarError: peticion.error?.status !== 422,
    pie: <ResultadoValidacion resultado={mostrado} />,
  }

  if (postulacion.sectorCodigo && !editando) {
    return (
      <Seccion {...base} ocultarGuardar>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Cargo al que postula" valor={guardado?.cargo ?? postulacion.sectorCodigo} className="sm:col-span-2" />
          <Dato etiqueta="Respaldo de una organización" valor={postulacion.tieneRespaldo ? 'Sí' : 'No'} />
          {postulacion.tieneRespaldo && <Dato etiqueta="Nombre de Organización" valor={postulacion.organizacionNombre} />}
          {postulacion.tieneRespaldo && (
            <Dato
              etiqueta="Documento de respaldo"
              valor={
                postulacion.organizacionDocumento ? (
                  <EnlaceDocumento documento={postulacion.organizacionDocumento} />
                ) : (
                  <span className="text-mal">Falta adjuntar el PDF: pulse Editar</span>
                )
              }
              className="sm:col-span-2"
            />
          )}
        </dl>
        <AccionesGuardado
          onEditar={() => {
            peticion.reset()
            setEditando(true)
          }}
          onEliminar={eliminar}
          titulo="¿Eliminar el cargo seleccionado?"
          mensaje="Se borrarán el cargo, la organización y su documento de respaldo. Podrá seleccionarlo otra vez."
        />
      </Seccion>
    )
  }

  return (
    <Seccion {...base} textoGuardar="Guardar postulación" ocultarGuardar={!mostrado?.cumple}>
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
                  {...register('sector', { onChange: (e) => validar(e.target.value) })}
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

      {validacion.loading && (
        <p className="flex items-center gap-2 text-sm text-tenue" role="status">
          <Spinner className="size-4" label="" />
          Consultando el Historial Laboral…
        </p>
      )}
      {validacion.error && <ErrorAlert error={validacion.error} />}

      {sector && mostrado?.cumple && (
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

      {/* Oculto, no desmontado: al cambiar Sí/No el documento ya subido sigue ahí. */}
      <div className={sector && mostrado?.cumple && tieneRespaldo ? 'grid gap-4' : 'hidden'}>
        <Input
          label="Nombre de Organización"
          required
          error={errors.organizacionNombre?.message}
          {...register('organizacionNombre')}
        />
        <CampoDocumento
          control={control}
          name="organizacionDocumentoId"
          categoria="RESPALDO_ORG"
          inicial={postulacion.organizacionDocumento}
          required
        />
      </div>
    </Seccion>
  )
}
