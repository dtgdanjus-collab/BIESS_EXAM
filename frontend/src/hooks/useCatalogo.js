import { useCallback, useEffect, useState } from 'react'
import { catalogos } from '../api/catalogos'

// Caché en memoria del navegador: cada catálogo se pide una sola vez por sesión
// (el backend además lo sirve desde Redis).
const cache = new Map()

/**
 * Carga un catálogo. Para los dependientes (provincias, cantones) se pasa el id padre;
 * si el padre es vacío no se consulta y se devuelve una lista vacía.
 */
export function useCatalogo(nombre, padreId) {
  const requierePadre = nombre === 'provincias' || nombre === 'cantones'
  const habilitado = !requierePadre || Boolean(padreId)
  const clave = requierePadre ? `${nombre}:${padreId}` : nombre

  const [estado, setEstado] = useState(() => ({
    data: cache.get(clave) ?? [],
    loading: habilitado && !cache.has(clave),
    error: null,
  }))

  const cargar = useCallback(async () => {
    if (!habilitado) {
      setEstado({ data: [], loading: false, error: null })
      return
    }
    if (cache.has(clave)) {
      setEstado({ data: cache.get(clave), loading: false, error: null })
      return
    }
    setEstado({ data: [], loading: true, error: null })
    try {
      const data = requierePadre ? await catalogos[nombre](padreId) : await catalogos[nombre]()
      cache.set(clave, data)
      setEstado({ data, loading: false, error: null })
    } catch (error) {
      setEstado({ data: [], loading: false, error })
    }
  }, [clave, habilitado, nombre, padreId, requierePadre])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { ...estado, recargar: cargar }
}
