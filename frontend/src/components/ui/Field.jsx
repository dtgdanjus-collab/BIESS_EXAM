import { useId } from 'react'
import { Icon } from './Icon'
import { Spinner } from './Spinner'

const base =
  'block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

const borde = (error) =>
  error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
    : 'border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-brand-100'

// Envoltura común: etiqueta, ayuda y mensaje de error accesibles.
function Campo({ id, label, error, hint, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600 animate-slide-down" role="alert">
          <Icon name="alert" className="size-3.5" strokeWidth={2} />
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
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
      <div className={`group/campo relative ${error ? 'animate-shake' : ''}`}>
        {icono && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400 transition-colors group-focus-within/campo:text-brand-600">
            <Icon name={icono} className="size-[18px]" />
          </span>
        )}
        <input
          id={id}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${base} ${borde(error)} ${icono ? 'pl-10' : ''} ${suffix ? 'pr-12' : ''}`}
          {...props}
        />
        {suffix && <span className="absolute inset-y-0 right-1.5 flex items-center">{suffix}</span>}
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
      <div className={`group/campo relative ${error ? 'animate-shake' : ''}`}>
        <select
          id={id}
          ref={ref}
          disabled={disabled || loading}
          aria-invalid={Boolean(error)}
          aria-busy={loading}
          className={`${base} ${borde(error)} appearance-none pr-10`}
          {...props}
        >
          <option value="">{loading ? 'Cargando…' : placeholder}</option>
          {options.map((o) => (
            <option key={getValue(o)} value={getValue(o)}>
              {getLabel(o)}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-slate-400">
          {loading ? (
            <Spinner className="size-4 text-brand-600" />
          ) : (
            <Icon name="chevronRight" className="size-4 rotate-90" strokeWidth={2} />
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
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 transition-colors hover:border-brand-300 has-checked:border-brand-500 has-checked:bg-brand-50/60"
      >
        <input
          id={id}
          ref={ref}
          type="checkbox"
          className="mt-0.5 size-[18px] shrink-0 rounded border-slate-300 accent-brand-700"
          {...props}
        />
        <span className="leading-relaxed">{label}</span>
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
  const opcion = (v, texto) => {
    const activo = value === v
    return (
      <label
        className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold transition-all active:scale-95 sm:min-w-28 sm:flex-none ${
          activo
            ? v
              ? 'border-brand-600 bg-brand-600 text-white shadow-glow'
              : 'border-slate-700 bg-slate-800 text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <input
          type="radio"
          name={name ?? id}
          className="sr-only"
          checked={activo}
          onChange={() => onChange(v)}
          disabled={disabled}
        />
        {activo && <Icon name="check" className="size-4 animate-pop" strokeWidth={2.5} />}
        {texto}
      </label>
    )
  }
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-semibold leading-relaxed text-slate-800">{label}</legend>
      <div className="flex gap-2">
        {opcion(true, 'Sí')}
        {opcion(false, 'No')}
      </div>
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600" role="alert">
          <Icon name="alert" className="size-3.5" strokeWidth={2} />
          {error}
        </p>
      )}
    </fieldset>
  )
}
