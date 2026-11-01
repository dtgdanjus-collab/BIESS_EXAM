import { Icon } from './Icon'

const estilos = {
  success: { caja: 'border-emerald-200/80 bg-emerald-50 text-emerald-900', chip: 'bg-emerald-500 text-white', icono: 'check' },
  error: { caja: 'border-red-200/80 bg-red-50 text-red-900', chip: 'bg-red-500 text-white', icono: 'x' },
  warning: { caja: 'border-amber-200/80 bg-amber-50 text-amber-900', chip: 'bg-amber-400 text-amber-950', icono: 'alert' },
  info: { caja: 'border-sky-200/80 bg-sky-50 text-sky-900', chip: 'bg-sky-500 text-white', icono: 'info' },
}

export function Alert({ type = 'info', title, children, className = '' }) {
  const e = estilos[type]
  return (
    <div
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-in ${e.caja} ${className}`}
    >
      <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${e.chip}`}>
        <Icon name={e.icono} className="size-3" strokeWidth={3} />
      </span>
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  )
}

/** Muestra un ApiError (mensaje del backend) o nada. */
export function ErrorAlert({ error, title, className }) {
  if (!error) return null
  return (
    <Alert type="error" title={title} className={className}>
      {error.message}
    </Alert>
  )
}
