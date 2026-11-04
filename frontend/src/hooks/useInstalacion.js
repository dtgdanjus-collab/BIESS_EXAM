import { useSyncExternalStore } from 'react'

// El navegador lanza este evento una sola vez y puede ser antes de iniciar sesión: se escucha desde que carga la app.
let solicitud = null
const oyentes = new Set()
const avisar = () => oyentes.forEach((oyente) => oyente())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  solicitud = e
  avisar()
})
window.addEventListener('appinstalled', () => {
  solicitud = null
  avisar()
})

const suscribir = (oyente) => {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
const esIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Android y escritorio abren la instalación del sistema; Safari en iPhone solo permite explicar los pasos. */
export function useInstalacion() {
  const disponible = useSyncExternalStore(suscribir, () => solicitud)
  return {
    puedeInstalar: Boolean(disponible),
    pasosIos: !instalada() && esIos(),
    instalar: async () => {
      await disponible.prompt()
      await disponible.userChoice
      solicitud = null
      avisar()
    },
  }
}
