import { createContext, use } from 'react'
import { Controller } from 'react-hook-form'
import { Alert, Button, Card, ErrorAlert, Icon, Select } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
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
export function Seccion({ id, numeral, titulo, descripcion, children, peticion, onSubmit, pie, mostrarError = true }) {
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
              {!soloLectura && (
                <div className="flex justify-end">
                  <Button type="submit" loading={peticion.loading} className="w-full sm:w-auto">
                    Guardar progreso
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
    <div role="img" aria-label={`Cédula ${cedula}`} className="grid max-w-sm grid-cols-10 gap-0.5 sm:gap-1">
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

/** Cada registro de una lista (familiar, título, experiencia…). */
export function ItemLista({ titulo, onEliminar, children }) {
  const { soloLectura } = useFormulario()
  return (
    <div className="overflow-hidden rounded-md border border-borde animate-slide-down">
      <div className="flex min-h-11 items-center justify-between gap-2 bg-fondo px-4">
        <p className="text-sm font-medium">{titulo}</p>
        {!soloLectura && onEliminar && (
          <Button variant="danger" className="-mr-2 px-2 text-xs lg:!min-h-8" onClick={onEliminar}>
            Eliminar
          </Button>
        )}
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">{children}</div>
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
