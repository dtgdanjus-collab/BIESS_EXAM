import { useId } from 'react'
import { Icon } from './Icon'
import { Spinner } from './Spinner'

const base =
  'block min-h-11 w-full rounded-md border bg-papel px-3 py-2 text-sm text-tinta transition-colors duration-150 placeholder:text-tenue focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-fondo disabled:text-tenue lg:min-h-10'

const borde = (error) =>
  error
    ? 'border-mal focus:border-mal focus:ring-mal'
    : 'border-control hover:border-[#a3a3a3] focus:border-tinta focus:ring-tinta'

const ErrorCampo = ({ id, children }) => (
  <p id={id} className="mt-1.5 flex items-center gap-1 text-xs text-mal animate-slide-down" role="alert">
    <Icon name="alert" className="size-3.5" strokeWidth={2} />
    {children}
  </p>
)

// El campo se describe con su error o, si no lo hay, con su ayuda.
const describir = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-ayuda` : undefined)

// Envoltura común: etiqueta, ayuda y mensaje de error accesibles.
function Campo({ id, label, error, hint, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
          {label}
          {required && <span className="text-mal"> *</span>}
        </label>
      )}
      {children}
      {error ? <ErrorCampo id={`${id}-error`}>{error}</ErrorCampo> : hint && <p id={`${id}-ayuda`} className="mt-1.5 text-xs text-tenue">{hint}</p>}
    </div>
  )
}

/**
 * Campo de texto. icono: ícono a la izquierda; suffix: elemento a la derecha
 * (p. ej. el botón para mostrar la contraseña).
 */
export function Input({ label, error, hint, required, className, ref, icono, suffix, ...props }) {
  const id = useId()
  return (
    <Campo id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <div className={`relative ${error ? 'animate-shake' : ''}`}>
        {icono && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-tenue">
            <Icon name={icono} className="size-4" />
          </span>
        )}
        <input
          id={id}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={describir(id, error, hint)}
          className={`${base} ${borde(error)} ${icono ? 'pl-9' : ''} ${suffix ? 'pr-12' : ''}`}
          {...props}
        />
        {suffix && <span className="absolute inset-y-0 right-1 flex items-center">{suffix}</span>}
      </div>
    </Campo>
  )
}

export function Textarea({ label, error, hint, required, className, ref, maxLength, value, ...props }) {
  const id = useId()
  const contador = maxLength && typeof value === 'string' ? `${value.length}/${maxLength}` : null
  return (
    <Campo id={id} label={label} error={error} hint={hint ?? contador} required={required} className={className}>
      <textarea
        id={id}
        ref={ref}
        maxLength={maxLength}
        value={value}
        rows={4}
        aria-invalid={Boolean(error)}
        aria-describedby={describir(id, error, hint ?? contador)}
        className={`${base} ${borde(error)} resize-y`}
        {...props}
      />
    </Campo>
  )
}

/** Select con estado de carga propio (útil en la cascada País → Provincia → Cantón). */
export function Select({
  label,
  error,
  hint,
  required,
  className,
  ref,
  options = [],
  placeholder = 'Seleccione…',
  loading = false,
  disabled,
  getValue = (o) => o.id,
  getLabel = (o) => o.nombre,
  ...props
}) {
  const id = useId()
  return (
    <Campo id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <div className={`relative ${error ? 'animate-shake' : ''}`}>
        <select
          id={id}
          ref={ref}
          disabled={disabled || loading}
          aria-invalid={Boolean(error)}
          aria-describedby={describir(id, error, hint)}
          aria-busy={loading}
          className={`${base} ${borde(error)} appearance-none pr-9`}
          {...props}
        >
          <option value="">{loading ? 'Cargando…' : placeholder}</option>
          {options.map((o) => (
            <option key={getValue(o)} value={getValue(o)}>
              {getLabel(o)}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-tenue">
          {loading ? <Spinner className="size-4" /> : <Icon name="chevronRight" className="size-4 rotate-90" strokeWidth={2} />}
        </span>
      </div>
    </Campo>
  )
}

export function Checkbox({ label, error, className = '', ref, ...props }) {
  const id = useId()
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 rounded-md bg-fondo p-3 text-sm transition-colors hover:bg-realce"
      >
        <input id={id} ref={ref} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-tinta" {...props} />
        <span className="leading-relaxed">{label}</span>
      </label>
      {error && <ErrorCampo>{error}</ErrorCampo>}
    </div>
  )
}

/** Pregunta Sí/No con dos marcas contiguas. value: true | false | null. */
export function SiNo({ label, value, onChange, error, name, disabled }) {
  const id = useId()
  const opcion = (v, texto) => {
    const activo = value === v
    return (
      <label
        className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center px-5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-tinta sm:min-w-20 sm:flex-none lg:min-h-9 ${
          activo ? 'bg-tinta text-white' : 'bg-realce text-tinta hover:bg-control'
        } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        <input
          type="radio"
          name={name ?? id}
          className="sr-only"
          checked={activo}
          onChange={() => onChange(v)}
          disabled={disabled}
        />
        {texto}
      </label>
    )
  }
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-2 text-sm font-medium leading-relaxed">{label}</legend>
      <div className="flex gap-px">
        {opcion(true, 'Sí')}
        {opcion(false, 'No')}
      </div>
      {error && <ErrorCampo id={`${id}-error`}>{error}</ErrorCampo>}
    </fieldset>
  )
}
