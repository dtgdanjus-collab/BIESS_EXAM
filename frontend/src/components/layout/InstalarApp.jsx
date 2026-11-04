import { useState } from 'react'
import { useInstalacion } from '../../hooks/useInstalacion'
import { Button, Icon, Modal } from '../ui'
import { Monograma } from './Monograma'

const VENTAJAS = [
  'Se abre desde su pantalla de inicio, como cualquier otra app.',
  'Abre las pantallas aunque se quede sin internet; para guardar y enviar sí lo necesita.',
  'Su expediente no se guarda en el dispositivo.',
]

/**
 * Descarga de la app con su ventana de confirmación. Solo aparece donde se puede instalar:
 * como botón en los accesos y, con «compacta», como tarjeta en el menú del perfil.
 */
export function InstalarApp({ compacta = false }) {
  const { puedeInstalar, pasosIos, instalar } = useInstalacion()
  const [abierta, setAbierta] = useState(false)

  if (!puedeInstalar && !pasosIos) return null

  const cerrar = () => setAbierta(false)
  const confirmar = () => {
    cerrar()
    instalar()
  }

  return (
    <>
      {compacta ? (
        <div className="border-t border-regla p-3">
          <button
            type="button"
            onClick={() => setAbierta(true)}
            className="flex min-h-16 w-full items-center gap-3 rounded-md bg-sello p-3 text-left text-white transition-colors hover:bg-[#174d9c]"
          >
            <Monograma className="size-10" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Instalar la app</span>
              <span className="block text-xs text-white/85">Tenga el concurso en su pantalla de inicio</span>
            </span>
            <Icon name="download" className="size-5 shrink-0" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-sello px-4 text-sm font-medium text-white transition-colors hover:bg-[#174d9c]"
        >
          <Icon name="download" className="size-5" strokeWidth={2} />
          Descargar la app
        </button>
      )}

      <Modal
        open={abierta}
        onClose={cerrar}
        title="¿Descargar la app del Directorio BIESS?"
        footer={
          puedeInstalar ? (
            <>
              <Button variant="secondary" onClick={cerrar}>
                Ahora no
              </Button>
              <Button onClick={confirmar}>Descargar</Button>
            </>
          ) : (
            <Button onClick={cerrar}>Entendido</Button>
          )
        }
      >
        <div className="mb-4 flex items-center gap-3 rounded-md bg-noche p-3 text-white">
          <Monograma className="size-12" />
          <p className="leading-tight">
            <span className="block text-base font-medium">Directorio BIESS</span>
            <span className="block text-xs text-noche-tenue">Concurso de Méritos y Oposición</span>
          </p>
        </div>
        {puedeInstalar ? (
          <ul className="space-y-2">
            {VENTAJAS.map((v) => (
              <li key={v} className="flex gap-2.5 text-tinta">
                <Icon name="check" className="mt-0.5 size-4 shrink-0 text-sello" strokeWidth={2.6} />
                {v}
              </li>
            ))}
          </ul>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-tinta">
            <li>Abra esta página en Safari.</li>
            <li>Pulse el botón Compartir.</li>
            <li>Elija «Agregar a inicio» y confirme.</li>
          </ol>
        )}
      </Modal>
    </>
  )
}
