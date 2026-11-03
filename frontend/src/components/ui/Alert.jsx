import { Icon } from './Icon'

const estilos = {
  success: { caja: 'bg-ok-fondo text-ok-tinta', icono: 'check' },
  error: { caja: 'bg-mal-fondo text-mal-tinta', icono: 'x' },
  warning: { caja: 'bg-aviso-fondo text-aviso-tinta', icono: 'alert' },
  info: { caja: 'bg-realce text-tinta', icono: 'info' },
}

export function Alert({ type = 'info', title, children, className = '' }) {
  const e = estilos[type]
  return (
    <div
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      className={`flex gap-2.5 rounded-md px-3 py-2.5 text-sm animate-slide-down ${e.caja} ${className}`}
    >
      <Icon name={e.icono} className="mt-0.5 size-4" strokeWidth={2} />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-medium">{title}</p>}
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
