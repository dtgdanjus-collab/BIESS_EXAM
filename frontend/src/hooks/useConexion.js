import { useSyncExternalStore } from 'react'

const suscribir = (avisar) => {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

/** Indica si el dispositivo tiene conexión. Guardar y enviar siempre necesitan al servidor. */
export const useConexion = () => useSyncExternalStore(suscribir, () => navigator.onLine)
