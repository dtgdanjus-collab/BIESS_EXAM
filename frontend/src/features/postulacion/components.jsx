import { createContext, use } from 'react'
import { Controller } from 'react-hook-form'
import { Alert, Button, Card, ErrorAlert, Select } from '../../components/ui'
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

/** Tarjeta de sección con numeral, título y pie con "Guardar progreso". */
export function Seccion({ id, numeral, titulo, descripcion, children, peticion, onSubmit, pie, mostrarError = true }) {
  const { soloLectura, irA } = useFormulario()
  const siguiente = siguienteSeccion(id)
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card
        title={
          <span>
            <span className="mr-2 text-brand-700">{numeral}</span>
            {titulo}
          </span>
        }
        description={descripcion}
      >
        <fieldset disabled={soloLectura || peticion?.loading} className="space-y-5">
          {children}
        </fieldset>

        {peticion && (
          <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
            {peticion.success && (
              <Alert type="success">
                Sección guardada.{' '}
                {siguiente && (
                  <button type="button" onClick={() => irA(siguiente.id)} className="font-semibold underline">
                    Continuar con {siguiente.titulo}
                  </button>
                )}
              </Alert>
            )}
            {mostrarError && peticion.error && !peticion.error.details?.campos && <ErrorAlert error={peticion.error} />}
            {peticion.error?.details?.campos && (
              <Alert type="error">Revise los campos marcados en rojo.</Alert>
            )}
            {pie}
            {!soloLectura && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="submit" loading={peticion.loading}>
                  Guardar progreso
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </form>
  )
}

/** Dato de solo lectura (etiqueta + valor). */
export function Dato({ etiqueta, valor, className = '' }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{valor || '—'}</dd>
    </div>
  )
}

/** Tarjeta para cada registro de una lista (familiar, título, experiencia…). */
export function ItemLista({ titulo, onEliminar, children }) {
  const { soloLectura } = useFormulario()
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{titulo}</p>
        {!soloLectura && onEliminar && (
          <Button variant="danger" className="min-h-8 px-2 py-1 text-xs" onClick={onEliminar}>
            Eliminar
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
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
      className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-50"
    >
      <span aria-hidden="true" className="text-lg leading-none">+</span>
      {children}
    </button>
  )
}

export function EstadoBadge({ estado }) {
  const estilos = {
    BORRADOR: 'bg-amber-100 text-amber-800',
    ENVIADA: 'bg-emerald-100 text-emerald-800',
    CERRADA: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilos[estado]}`}>
      {estado}
    </span>
  )
}

/** Convierte "" en null y recorta (para enviar opcionales al backend). */
export const opcional = (v) => {
  const t = typeof v === 'string' ? v.trim() : v
  return t === '' || t === undefined ? null : t
}
