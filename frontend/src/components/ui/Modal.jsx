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
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      {open && (
        <div>
          <header className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          </header>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm text-slate-700">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
