import { Spinner } from './Spinner'

const variantes = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-slate-400',
  danger: 'text-red-700 hover:bg-red-50 disabled:text-slate-400',
}

// Botón con estado de carga: se deshabilita y muestra un spinner mientras loading=true.
export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${variantes[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4" label="Procesando" />}
      {children}
    </button>
  )
}
