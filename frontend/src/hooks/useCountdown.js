import { useCallback, useEffect, useState } from 'react'

// Cuenta regresiva en segundos (para el bloqueo 423). Calcula contra una hora de fin
// para no acumular desfase si la pestaña se queda en segundo plano.
export function useCountdown() {
  const [fin, setFin] = useState(null)
  const [restante, setRestante] = useState(0)

  useEffect(() => {
    if (!fin) return undefined
    const tick = () => {
      const seg = Math.max(0, Math.ceil((fin - Date.now()) / 1000))
      setRestante(seg)
      if (seg === 0) setFin(null)
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [fin])

  const iniciar = useCallback((segundos) => {
    if (segundos > 0) setFin(Date.now() + segundos * 1000)
  }, [])

  return { restante, activo: restante > 0, iniciar, texto: formatoMMSS(restante) }
}

export function formatoMMSS(segundos) {
  const m = String(Math.floor(segundos / 60)).padStart(2, '0')
  const s = String(segundos % 60).padStart(2, '0')
  return `${m}:${s}`
}
