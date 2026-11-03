import { useEffect, useId, useRef } from 'react'

// Diálogo modal nativo (<dialog>): gestiona foco, Escape y fondo automáticamente.
export function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null)
  const idTitulo = useId()

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
      aria-labelledby={idTitulo}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border-0 bg-papel p-0 text-tinta shadow-flota backdrop:bg-black/50"
    >
      {open && (
        <div>
          <header className="px-6 pt-5">
            <h2 id={idTitulo} className="text-base font-medium">
              {title}
            </h2>
          </header>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-3 text-sm leading-relaxed text-tenue">{children}</div>
          {footer && <footer className="flex justify-end gap-2 px-6 pb-5 pt-2">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
