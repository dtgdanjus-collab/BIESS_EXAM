import { useEffect, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { Monograma } from '../../components/layout/Layouts'
import { FormularioVista } from './FormularioVista'

const fechaRecibida = (iso) => new Date(iso).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' })

/**
 * Lo único que sale en el papel: el formulario sobre blanco, sin la interfaz alrededor. Existe solo
 * mientras se imprime. Las filas vacías de la tabla repiten el margen en cada hoja, porque con margen
 * de página cero el navegador no añade la dirección ni la fecha.
 */
export function HojaImpresion({ formulario }) {
  const [imprimiendo, setImprimiendo] = useState(false)

  useEffect(() => {
    let titulo = ''
    const antes = () => {
      // El navegador propone este título como nombre del archivo al guardar en PDF.
      titulo = document.title
      document.title = `Formulario ${formulario.codigo}`
      flushSync(() => setImprimiendo(true))
    }
    const despues = () => {
      document.title = titulo
      setImprimiendo(false)
    }
    window.addEventListener('beforeprint', antes)
    window.addEventListener('afterprint', despues)
    return () => {
      window.removeEventListener('beforeprint', antes)
      window.removeEventListener('afterprint', despues)
    }
  }, [formulario.codigo])

  if (!imprimiendo) return null

  return createPortal(
    <div className="hoja-impresion bg-white text-tinta">
      <style>{'@page { size: A4; margin: 0 }'}</style>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <td className="h-[14mm]" />
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td className="h-[14mm]" />
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td className="px-[18mm] align-top">
              <header className="mb-7 border-b-2 border-sello pb-4">
                <div className="flex items-center gap-2.5">
                  <Monograma />
                  <p className="text-sm leading-tight">
                    <span className="block font-medium">Directorio BIESS</span>
                    <span className="text-tenue">Concurso Público de Méritos y Oposición</span>
                  </p>
                </div>
                <h1 className="mt-5 text-2xl font-medium tracking-tight">Formulario de postulación</h1>
                <p className="mt-1 font-mono text-base">{formulario.codigo}</p>
                <p className="text-sm text-tenue">
                  {formulario.estado === 'ENVIADA' && formulario.fechaEnvio ? `Recibida el ${fechaRecibida(formulario.fechaEnvio)}` : 'Borrador: aún no se ha enviado'}
                </p>
              </header>
              <FormularioVista formulario={formulario} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>,
    document.body,
  )
}
