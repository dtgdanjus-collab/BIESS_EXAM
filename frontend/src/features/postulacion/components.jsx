import { createContext, use, useId, useState } from 'react'
import { Controller, useController } from 'react-hook-form'
import { postulacionApi } from '../../api/postulacion'
import { Alert, Button, Card, ErrorAlert, Icon, Modal, Select, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { guardarArchivo } from '../../utils/descargas'
import { aplicarErroresCampos } from '../../utils/formErrors'
import { siguienteSeccion } from './secciones'

/**
 * Contexto del formulario: la postulación vigente, cómo reemplazarla tras guardar,
 * cómo navegar entre secciones y si es de solo lectura (ENVIADA).
 */
export const FormularioContext = createContext(null)
export const useFormulario = () => use(FormularioContext)

/**
 * Guarda una sección: ejecuta la llamada, actualiza la postulación con la respuesta
 * del backend y vuelca los errores por campo en el formulario.
 */
export function useGuardarSeccion() {
  const { actualizar } = useFormulario()
  const peticion = useAsync()

  const guardar = async (llamada, setError) => {
    const r = await peticion.run(llamada)
    if (r.ok) actualizar(r.data)
    else if (setError) aplicarErroresCampos(r.error, setError)
    return r
  }

  return { ...peticion, guardar }
}

/**
 * Select controlado por React Hook Form. Controlado (no "register") para que el valor
 * guardado se muestre aunque las opciones lleguen después (catálogos asíncronos).
 * onCambio permite reaccionar al cambio (p. ej. resetear los hijos de la cascada).
 */
export function CampoSelect({ control, name, onCambio, ...props }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select
          {...props}
          ref={field.ref}
          name={field.name}
          value={field.value ?? ''}
          onBlur={field.onBlur}
          onChange={(e) => {
            field.onChange(e.target.value)
            onCambio?.(e.target.value)
          }}
          error={fieldState.error?.message}
        />
      )}
    />
  )
}

/** Folio del formulario con su barra de "Guardar progreso". */
export function Seccion({ id, numeral, titulo, descripcion, children, peticion, onSubmit, pie, mostrarError = true, textoGuardar = 'Guardar progreso', ocultarGuardar = false }) {
  const { soloLectura, irA } = useFormulario()
  const siguiente = siguienteSeccion(id)
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card
        numeral={numeral}
        title={titulo}
        description={descripcion}
        nota={!soloLectura && peticion && 'Su avance se guarda como borrador hasta que lo envíe.'}
        pie={
          // En solo lectura no hay nada que mostrar al pie, salvo lo que aporte el folio.
          peticion && (!soloLectura || pie) && (
            <>
              {peticion.success && (
                <Alert type="success">
                  Sección guardada.{' '}
                  {siguiente && (
                    <button
                      type="button"
                      onClick={() => irA(siguiente.id)}
                      className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
                    >
                      Continuar con {siguiente.titulo}
                      <Icon name="arrowRight" className="size-3.5" strokeWidth={2} />
                    </button>
                  )}
                </Alert>
              )}
              {mostrarError && peticion.error && !peticion.error.details?.campos && <ErrorAlert error={peticion.error} />}
              {peticion.error?.details?.campos && <Alert type="error">Revise los campos marcados en rojo.</Alert>}
              {pie}
              {!soloLectura && !ocultarGuardar && (
                <div className="flex flex-col justify-end gap-2 sm:flex-row">
                  {/* El requerimiento pide «Guardar Progreso» en cada campo, además del botón propio del campo. */}
                  {textoGuardar !== 'Guardar progreso' && (
                    <Button type="submit" variant="secondary" disabled={peticion.loading} className="w-full sm:w-auto">
                      Guardar progreso
                    </Button>
                  )}
                  <Button type="submit" loading={peticion.loading} className="w-full sm:w-auto">
                    {textoGuardar}
                  </Button>
                </div>
              )}
            </>
          )
        }
      >
        <fieldset disabled={soloLectura || peticion?.loading} className="space-y-8">
          {children}
        </fieldset>
      </Card>
    </form>
  )
}

/** Bloque de campos de un folio con su propio título. */
export function Grupo({ titulo, children, className = 'grid gap-4 sm:grid-cols-2' }) {
  return (
    <section>
      <h3 className="mb-4 border-b border-regla pb-2 text-base font-medium">{titulo}</h3>
      <div className={className}>{children}</div>
    </section>
  )
}

/** La cédula en celdas, como se lee en el acceso. */
export function CeldasCedula({ cedula }) {
  return (
    <div role="img" aria-label={`Cédula ${cedula}`} className="grid w-full min-w-60 max-w-sm grid-cols-10 gap-0.5 sm:gap-1">
      {[...cedula].map((digito, i) => (
        <span key={i} className={`flex aspect-[4/5] items-center justify-center text-sm font-medium tabular-nums text-white sm:text-lg ${i === 9 ? 'bg-sello' : 'bg-tinta'}`}>
          {digito}
        </span>
      ))}
    </div>
  )
}

/** Dato de solo lectura (etiqueta + valor). */
export function Dato({ etiqueta, valor, className = '' }) {
  return (
    <div className={className}>
      <dt className="text-xs text-tenue">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm">{valor || <span className="text-tenue">—</span>}</dd>
    </div>
  )
}

/**
 * Qué registros de una lista se ven cerrados, solo con Editar y Eliminar: los ya guardados.
 * Uno con errores se abre solo, para que se vea qué corregir.
 */
export function useItemsPlegables(fields, errores) {
  const [plegados, setPlegados] = useState(() => new Set(fields.map((f) => f.id)))
  return {
    plegado: (f, i) => plegados.has(f.id) && !errores?.[i],
    editar: (f) =>
      setPlegados((actuales) => {
        const nuevos = new Set(actuales)
        nuevos.delete(f.id)
        return nuevos
      }),
    plegarTodos: () => setPlegados(new Set(fields.map((f) => f.id))),
  }
}

/** Cada registro de una lista (familiar, título, experiencia…). */
export function ItemLista({ titulo, resumen, aviso, plegado = false, onEditar, onEliminar, children }) {
  const { soloLectura } = useFormulario()
  const cerrado = plegado && !soloLectura
  return (
    <div className="overflow-hidden rounded-md border border-borde animate-slide-down">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-2 bg-fondo px-4 py-1">
        <div className="min-w-0 flex-1 py-1">
          <p className="text-sm font-medium">{titulo}</p>
          {cerrado && resumen && <p className="truncate text-xs text-tenue">{resumen}</p>}
          {cerrado && aviso && <p className="text-xs text-mal">{aviso}</p>}
        </div>
        {!soloLectura && (
          <div className="-mr-2 flex">
            {cerrado && onEditar && (
              <Button variant="ghost" className="px-2 text-xs lg:!min-h-8" onClick={onEditar} aria-label={`Editar ${titulo}`}>
                Editar
              </Button>
            )}
            {onEliminar && (
              <Button variant="danger" className="px-2 text-xs lg:!min-h-8" onClick={onEliminar} aria-label={`Eliminar ${titulo}`}>
                Eliminar
              </Button>
            )}
          </div>
        )}
      </div>
      {/* Cerrado sigue montado: sus campos conservan el valor y el PDF subido. */}
      <div className={cerrado ? 'hidden' : 'grid gap-4 p-4 sm:grid-cols-2'}>{children}</div>
    </div>
  )
}

// Límites del requerimiento: 4 MB el respaldo de la organización (1.4) y 2 MB los demás.
const MAX_MB = { RESPALDO_ORG: 4, FORMACION: 2, EXPERIENCIA: 2, PUBLICACION: 2, CAPACITACION: 2 }

const textoTamano = (bytes) => (bytes >= 1 << 20 ? `${(bytes / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

/** Datos del PDF de un registro tal como llegan del backend, para mostrarlo al editar. */
export const adjuntoDe = (item) =>
  item.documentoId ? { id: item.documentoId, nombre: item.documentoNombre, tamanoBytes: item.documentoTamano } : null

/** Descarga un PDF con la sesión. Es un enlace porque un botón quedaría inactivo en el modo de solo lectura. */
export function EnlaceDocumento({ documento, descargar = (d) => postulacionApi.descargarDocumento(d.id) }) {
  const descarga = useAsync()
  const bajar = async (e) => {
    e.preventDefault()
    const r = await descarga.run(() => descargar(documento))
    if (r.ok) guardarArchivo(r.data, documento.nombre)
  }
  return (
    <>
      <a href={`#documento-${documento.id}`} onClick={bajar} className="break-all underline underline-offset-4">
        {documento.nombre}
      </a>
      {descarga.loading && <Spinner className="ml-2 inline size-3.5" label="Descargando" />}
      {descarga.error && <span className="ml-2 text-xs text-mal" role="alert">No se pudo descargar</span>}
    </>
  )
}

/** Sube un PDF y guarda su id en el formulario. El registro lo usa al guardar la sección. */
export function CampoDocumento({ control, name, categoria, inicial, required = false, className = '' }) {
  const { soloLectura } = useFormulario()
  const { field, fieldState } = useController({ control, name })
  const [documento, setDocumento] = useState(inicial ?? null)
  const [errorLocal, setErrorLocal] = useState(null)
  const subida = useAsync()
  const idError = useId()
  const maximo = MAX_MB[categoria]

  const alElegir = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = '' // para poder volver a elegir el mismo archivo
    if (!archivo) return
    setErrorLocal(null)
    if (!/\.pdf$/i.test(archivo.name)) return setErrorLocal('El documento debe estar en formato PDF')
    if (archivo.size === 0) return setErrorLocal('El archivo está vacío')
    if (archivo.size > maximo * (1 << 20)) return setErrorLocal(`El documento supera el máximo de ${maximo} MB`)
    const r = await subida.run(() => postulacionApi.subirDocumento(categoria, archivo))
    if (r.ok) {
      setDocumento(r.data)
      field.onChange(r.data.id)
    } else {
      setErrorLocal(r.error.details?.campos?.archivo ?? r.error.message)
    }
  }
  const quitar = () => {
    setDocumento(null)
    setErrorLocal(null)
    field.onChange(null)
  }

  const error = errorLocal ?? fieldState.error?.message
  const etiqueta = documento ? 'Reemplazar' : 'Seleccionar PDF'
  return (
    <div className={className}>
      <p className="mb-1.5 text-sm font-medium">
        Documento de respaldo
        {required && <span className="text-mal">&nbsp;*</span>}
      </p>
      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border px-3 py-2 ${error ? 'border-mal' : 'border-control'} ${documento ? '' : 'border-dashed'}`}>
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-2 text-sm">
          <Icon name="file" className="size-4 shrink-0 text-tenue" />
          {documento ? (
            <span className="min-w-0">
              <EnlaceDocumento documento={documento} />
              <span className="ml-2 whitespace-nowrap text-xs tabular-nums text-tenue">{textoTamano(documento.tamanoBytes)}</span>
            </span>
          ) : (
            <span className="text-tenue">{soloLectura ? 'Sin documento' : `Formato PDF, máximo ${maximo} MB`}</span>
          )}
        </div>
        {!soloLectura && (
          <div className="flex items-center gap-1">
            {subida.loading ? (
              <span className="flex min-h-11 items-center gap-2 text-sm text-tenue" role="status">
                <Spinner className="size-4" label="" />
                Subiendo…
              </span>
            ) : (
              <>
                <label className="flex min-h-11 cursor-pointer items-center rounded-md px-2 text-sm font-medium underline-offset-4 hover:underline has-focus-visible:outline-2 has-focus-visible:outline-tinta pointer-fine:lg:min-h-10">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    aria-label={`Documento de respaldo en PDF, máximo ${maximo} MB`}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? idError : undefined}
                    onChange={alElegir}
                  />
                  {etiqueta}
                </label>
                {documento && (
                  <Button variant="danger" className="px-2" onClick={quitar}>
                    Quitar
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {error && (
        <p id={idError} className="mt-1.5 flex items-center gap-1 text-xs text-mal animate-slide-down" role="alert">
          <Icon name="alert" className="size-3.5" strokeWidth={2} />
          {error}
        </p>
      )}
    </div>
  )
}

/** Editar y Eliminar de un campo ya guardado. Eliminar se aplica de inmediato, por eso pide confirmación. */
export function AccionesGuardado({ onEditar, onEliminar, titulo, mensaje }) {
  const { soloLectura } = useFormulario()
  const [confirmar, setConfirmar] = useState(false)
  if (soloLectura) return null
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={onEditar}>Editar</Button>
      <Button variant="danger" onClick={() => setConfirmar(true)}>Eliminar</Button>
      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title={titulo}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmar(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                setConfirmar(false)
                onEliminar()
              }}
            >
              Sí, eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed">{mensaje}</p>
      </Modal>
    </div>
  )
}

export function AgregarItem({ onClick, children }) {
  const { soloLectura } = useFormulario()
  if (soloLectura) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-control text-sm font-medium transition-colors hover:border-tinta hover:bg-fondo"
    >
      <Icon name="plus" className="size-4" strokeWidth={2} />
      {children}
    </button>
  )
}

const ESTADOS = {
  BORRADOR: { texto: 'Borrador', clase: 'bg-realce text-tinta' },
  ENVIADA: { texto: 'Enviada', clase: 'bg-ok-fondo text-ok-tinta' },
  CERRADA: { texto: 'Cerrada', clase: 'bg-mal-fondo text-mal-tinta' },
}

export function EstadoBadge({ estado, className = '' }) {
  const e = ESTADOS[estado] ?? ESTADOS.BORRADOR
  return <span className={`inline-flex h-6 flex-none items-center whitespace-nowrap rounded px-2 text-xs font-medium ${e.clase} ${className}`}>{e.texto}</span>
}

/** Convierte "" en null y recorta (para enviar opcionales al backend). */
export const opcional = (v) => {
  const t = typeof v === 'string' ? v.trim() : v
  return t === '' || t === undefined ? null : t
}
