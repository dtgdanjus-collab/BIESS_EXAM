import { Spinner } from './Spinner'

const variantes = {
  primary:
    'bg-gradient-to-b from-brand-600 to-brand-800 text-white shadow-glow ring-1 ring-inset ring-white/10 hover:from-brand-500 hover:to-brand-700 hover:-translate-y-px active:translate-y-0 disabled:from-brand-700/50 disabled:to-brand-800/50 disabled:shadow-none disabled:translate-y-0',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-slate-400',
  danger: 'text-red-600 hover:bg-red-50 disabled:text-slate-400',
  light: 'bg-white/10 text-white ring-1 ring-inset ring-white/20 backdrop-blur hover:bg-white/20',
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 disabled:cursor-not-allowed ${variantes[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4" label="Procesando" />}
      {children}
    </button>
  )
}
