import { useEffect } from 'react'

/** Nombra la pestaña según la pantalla: es lo primero que anuncia un lector de pantalla. */
export function useTituloPagina(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Directorio BIESS` : 'Directorio BIESS'
  }, [titulo])
}
