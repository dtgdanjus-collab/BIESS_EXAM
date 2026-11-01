import { useEffect, useRef } from 'react'

// Diálogo modal nativo (<dialog>): gestiona foco, Escape y fondo automáticamente.
export function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    // Respaldo con el atributo "open" donde showModal no existe (jsdom, navegadores antiguos).
    if (open && !d.open) d.showModal ? d.showModal() : d.setAttribute('open', '')
    if (!open && d.open) d.close ? d.close() : d.removeAttribute('open')
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border-0 p-0 shadow-lift ring-1 ring-slate-900/5 backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div>
          <header className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
          </header>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-600">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
