const estilos = {
  success: { caja: 'border-emerald-200 bg-emerald-50 text-emerald-900', icono: '✔' },
  error: { caja: 'border-red-200 bg-red-50 text-red-900', icono: '✖' },
  warning: { caja: 'border-amber-200 bg-amber-50 text-amber-900', icono: '!' },
  info: { caja: 'border-sky-200 bg-sky-50 text-sky-900', icono: 'i' },
}

export function Alert({ type = 'info', title, children, className = '' }) {
  const e = estilos[type]
  return (
    <div
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${e.caja} ${className}`}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-current/10 text-xs font-bold"
      >
        {e.icono}
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
