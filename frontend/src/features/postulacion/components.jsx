import { createContext, use } from 'react'
import { Controller } from 'react-hook-form'
import { Alert, Button, Card, ErrorAlert, Icon, Select } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { aplicarErroresCampos } from '../../utils/formErrors'
import { SECCIONES, siguienteSeccion } from './secciones'

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

/** Tarjeta de sección con ícono, numeral, título y barra con "Guardar progreso". */
export function Seccion({ id, numeral, titulo, descripcion, children, peticion, onSubmit, pie, mostrarError = true }) {
  const { soloLectura, irA } = useFormulario()
  const siguiente = siguienteSeccion(id)
  const icono = SECCIONES.find((s) => s.id === id)?.icono
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card icono={icono} eyebrow={`Sección ${numeral}`} title={titulo} description={descripcion}>
        <fieldset disabled={soloLectura || peticion?.loading} className="space-y-6">
          {children}
        </fieldset>

        {peticion && (
          <div className="-mx-5 -mb-6 mt-8 space-y-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:-mx-7 sm:px-7">
            {peticion.success && (
              <Alert type="success">
                Sección guardada.{' '}
                {siguiente && (
                  <button
                    type="button"
                    onClick={() => irA(siguiente.id)}
                    className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
                  >
                    Continuar con {siguiente.titulo}
                    <Icon name="arrowRight" className="size-3.5" strokeWidth={2.4} />
                  </button>
                )}
              </Alert>
            )}
            {mostrarError && peticion.error && !peticion.error.details?.campos && <ErrorAlert error={peticion.error} />}
            {peticion.error?.details?.campos && <Alert type="error">Revise los campos marcados en rojo.</Alert>}
            {pie}
            {!soloLectura && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Icon name="lock" className="size-3.5" />
                  Su avance se guarda como borrador hasta que lo envíe.
                </p>
                <Button type="submit" loading={peticion.loading} className="w-full sm:w-auto">
                  {!peticion.loading && <Icon name="save" className="size-4" />}
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
      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{etiqueta}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{valor || '—'}</dd>
    </div>
  )
}

/** Tarjeta para cada registro de una lista (familiar, título, experiencia…). */
export function ItemLista({ titulo, onEliminar, children }) {
  const { soloLectura } = useFormulario()
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-4 transition-shadow hover:shadow-card sm:p-5 animate-scale-in">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-500 to-gold-400" aria-hidden="true" />
          {titulo}
        </p>
        {!soloLectura && onEliminar && (
          <Button variant="danger" className="min-h-8 rounded-lg px-2.5 py-1 text-xs" onClick={onEliminar}>
            <Icon name="trash" className="size-3.5" />
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
      className="group flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 px-4 py-4 text-sm font-semibold text-brand-700 transition-all hover:border-brand-400 hover:bg-brand-50/60"
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-transform group-hover:scale-110">
        <Icon name="plus" className="size-3.5" strokeWidth={2.6} />
      </span>
      {children}
    </button>
  )
}

const ESTADOS = {
  BORRADOR: { texto: 'Borrador', clase: 'bg-amber-100 text-amber-800 ring-amber-200', punto: 'bg-amber-500' },
  ENVIADA: { texto: 'Enviada', clase: 'bg-emerald-100 text-emerald-800 ring-emerald-200', punto: 'bg-emerald-500' },
  CERRADA: { texto: 'Cerrada', clase: 'bg-red-100 text-red-800 ring-red-200', punto: 'bg-red-500' },
}

export function EstadoBadge({ estado, className = '' }) {
  const e = ESTADOS[estado] ?? ESTADOS.BORRADOR
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${e.clase} ${className}`}>
      <span className={`size-1.5 rounded-full ${e.punto}`} aria-hidden="true" />
      {e.texto}
    </span>
  )
}

/** Convierte "" en null y recorta (para enviar opcionales al backend). */
export const opcional = (v) => {
  const t = typeof v === 'string' ? v.trim() : v
  return t === '' || t === undefined ? null : t
}
