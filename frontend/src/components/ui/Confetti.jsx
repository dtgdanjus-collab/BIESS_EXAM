import { createPortal } from 'react-dom'

const COLORES = ['#e6c77f', '#d6ab55', '#2a876d', '#4aa488', '#aedccb', '#faf1dc']

// Lluvia breve de confeti (solo CSS) para celebrar el envío de la postulación.
// Va en un portal a <body>: dentro de un contenedor con transform, "fixed" no cubriría
// toda la ventana. Las posiciones salen del índice: no necesita estado ni temporizadores.
export function Confetti({ piezas = 60 }) {
  return createPortal(
    <div aria-hidden="true" className="no-print pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: piezas }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 h-3 w-1.5 rounded-sm animate-confetti"
          style={{
            left: `${((i * 37) % 100) + 0.5}%`,
            backgroundColor: COLORES[i % COLORES.length],
            '--retraso': `${((i * 13) % 12) * 0.09}s`,
            '--duracion': `${1.8 + ((i * 7) % 9) * 0.2}s`,
            '--deriva': `${((i * 53) % 160) - 80}px`,
            '--giro': `${360 + (i % 6) * 120}deg`,
          }}
        />
      ))}
    </div>,
    document.body,
  )
}
