import { useCallback, useState } from 'react'
import { useCountdown } from './useCountdown'

/**
 * Interpreta las respuestas de seguridad del backend (EF-11):
 *  - 401 con intentosRestantes → aviso de intentos que quedan
 *  - 423 con segundosRestantes → bloqueo con cuenta regresiva mm:ss
 */
export function useBloqueo() {
  const { iniciar, activo, texto } = useCountdown()
  const [intentosRestantes, setIntentos] = useState(null)

  const procesarError = useCallback(
    (error) => {
      if (error?.status === 423) {
        setIntentos(null)
        iniciar(error.details?.segundosRestantes ?? 0)
      } else if (typeof error?.details?.intentosRestantes === 'number') {
        setIntentos(error.details.intentosRestantes)
      }
    },
    [iniciar],
  )

  const limpiar = useCallback(() => setIntentos(null), [])

  return { bloqueado: activo, tiempo: texto, intentosRestantes, procesarError, limpiar }
}
