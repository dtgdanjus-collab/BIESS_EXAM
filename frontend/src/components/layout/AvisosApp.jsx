import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useConexion } from '../../hooks/useConexion'
import { Button } from '../ui'

const MEDIA_HORA = 30 * 60 * 1000

/** Avisos de la app instalada: falta de conexión y versión nueva. */
export function AvisosApp() {
  const enLinea = useConexion()
  const { pathname } = useLocation()
  const {
    needRefresh: [hayVersion, setHayVersion],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_, registro) {
      if (registro) setInterval(() => registro.update().catch(() => {}), MEDIA_HORA)
    },
  })

  return (
    <>
      {/* Durante el examen no se ofrece recargar: el tiempo sigue corriendo en el servidor. */}
      {hayVersion && pathname !== '/evaluacion' && (
        <div role="status" className={`no-print fixed inset-x-4 z-50 rounded-lg border border-borde bg-papel p-4 text-tinta shadow-flota sm:left-auto sm:w-96 ${enLinea ? 'bottom-4' : 'bottom-16'}`}>
          <p className="text-sm font-medium">Hay una versión nueva del sistema</p>
          <p className="mt-1 text-sm text-tenue">Guarde lo que esté escribiendo antes de actualizar.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setHayVersion(false)}>
              Más tarde
            </Button>
            <Button onClick={() => updateServiceWorker(true)}>Actualizar</Button>
          </div>
        </div>
      )}
      {!enLinea && (
        <p role="status" className="no-print fixed inset-x-0 bottom-0 z-50 bg-noche px-4 py-3 text-center text-sm text-white">
          Sin conexión. Lo escrito sigue en pantalla, pero para guardar o enviar necesita internet.
        </p>
      )}
    </>
  )
}
