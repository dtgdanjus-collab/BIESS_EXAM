import { Icon } from './Icon'

/** Tarjeta base. icono y eyebrow (texto pequeño sobre el título) son opcionales. */
export function Card({ title, description, actions, icono, eyebrow, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white shadow-card ring-1 ring-slate-900/5 ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-start gap-4">
            {icono && (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/60">
                <Icon name={icono} className="size-[22px]" />
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-600">{eyebrow}</p>
              )}
              {title && <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>}
              {description && <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-6 sm:px-7">{children}</div>
    </section>
  )
}
