import { useId } from 'react'
import { Spinner } from './Spinner'

const base =
  'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500'

const borde = (error) =>
  error
    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
    : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'

// Envoltura común: etiqueta, ayuda y mensaje de error accesibles.
function Campo({ id, label, error, hint, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
}

export function Input({ label, error, hint, required, className, ref, ...props }) {
  const id = useId()
  return (
    <Campo id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <input
        id={id}
        ref={ref}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${base} ${borde(error)}`}
        {...props}
      />
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
      <div className="relative">
        <select
          id={id}
          ref={ref}
          disabled={disabled || loading}
          aria-invalid={Boolean(error)}
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
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          {loading ? (
            <Spinner className="size-4 text-brand-600" />
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
              <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
            </svg>
          )}
        </span>
      </div>
    </Campo>
  )
}

export function Checkbox({ label, error, className = '', ref, ...props }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
        <input
          id={id}
          ref={ref}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-brand-700"
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** Pregunta Sí/No con botones de opción. value: true | false | null. */
export function SiNo({ label, value, onChange, error, name, disabled }) {
  const id = useId()
  const opcion = (v, texto) => (
    <label
      className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors sm:flex-none ${
        value === v
          ? 'border-brand-600 bg-brand-50 text-brand-800'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <input
        type="radio"
        name={name ?? id}
        className="sr-only"
        checked={value === v}
        onChange={() => onChange(v)}
        disabled={disabled}
      />
      {texto}
    </label>
  )
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">{label}</legend>
      <div className="flex gap-2">
        {opcion(true, 'Sí')}
        {opcion(false, 'No')}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
