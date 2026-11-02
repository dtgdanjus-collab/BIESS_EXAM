import { useEffect, useRef, useState } from 'react'

// Lleva un número hacia su nuevo valor en una animación corta (contador del avance).
// Si el usuario pidió reducir el movimiento, o no hay requestAnimationFrame, salta directo.
export function useAnimatedNumber(valor, duracion = 700) {
  const [actual, setActual] = useState(0)
  const desde = useRef(0)

  useEffect(() => {
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducir || !window.requestAnimationFrame) {
      desde.current = valor
      setActual(valor)
      return undefined
    }
    const inicio = desde.current
    const t0 = performance.now()
    let id
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / duracion)
      const n = Math.round(inicio + (valor - inicio) * (1 - (1 - p) ** 3))
      desde.current = n
      setActual(n)
      if (p < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [valor, duracion])

  return actual
}
