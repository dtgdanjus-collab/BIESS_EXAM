export function Spinner({ className = 'size-5', label = 'Cargando' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" role="status" aria-label={label}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function PageLoader({ texto = 'Cargando…' }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-slate-500 animate-fade-in">
      <div className="relative flex size-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-200/60" />
        <span className="relative flex size-14 items-center justify-center rounded-full bg-white shadow-card ring-1 ring-slate-900/5">
          <Spinner className="size-6 text-brand-600" />
        </span>
      </div>
      <p className="text-sm font-medium">{texto}</p>
    </div>
  )
}
