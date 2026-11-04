import { useState } from 'react'
import { Button, Icon, Modal } from '../../components/ui'
import { useInstalacion } from '../../hooks/useInstalacion'

/** Botón de descarga del acceso, con su ventana de confirmación. Solo aparece donde se puede instalar. */
export function InstalarApp() {
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
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-sello px-4 text-sm font-medium text-white transition-colors hover:bg-[#174d9c]"
      >
        <Icon name="download" className="size-5" strokeWidth={2} />
        Descargar la app
      </button>

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
        {puedeInstalar ? (
          <p>Se agregará a su pantalla de inicio y abrirá como cualquier otra app. Su expediente no se guarda en el dispositivo; para guardar y enviar necesita internet.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5">
            <li>Abra esta página en Safari.</li>
            <li>Pulse el botón Compartir.</li>
            <li>Elija «Agregar a inicio» y confirme.</li>
          </ol>
        )}
      </Modal>
    </>
  )
}
