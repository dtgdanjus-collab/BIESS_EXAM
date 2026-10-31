import { useCallback, useEffect, useRef, useState } from 'react'

const inicial = { status: 'idle', data: null, error: null }

// Maneja el ciclo loading → success | error de una llamada asíncrona.
// run() nunca lanza: devuelve { ok, data, error } para que el componente decida qué hacer.
export function useAsync() {
  const [state, setState] = useState(inicial)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const run = useCallback(async (fn) => {
    setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      const data = await fn()
      if (montado.current) setState({ status: 'success', data, error: null })
      return { ok: true, data }
    } catch (error) {
      if (montado.current) setState({ status: 'error', data: null, error })
      return { ok: false, error }
    }
  }, [])

  const reset = useCallback(() => setState(inicial), [])

  return {
    ...state,
    loading: state.status === 'loading',
    success: state.status === 'success',
    run,
    reset,
  }
}
