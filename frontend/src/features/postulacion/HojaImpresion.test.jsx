import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HojaImpresion } from './HojaImpresion'

const formulario = { codigo: 'BIESS-2026-000001', estado: 'BORRADOR', fechaEnvio: null, secciones: [], consentimiento: [], firmaNombres: 'Ana', firmaCedula: '0102345675' }

describe('HojaImpresion', () => {
  it('solo existe mientras se imprime y nombra el archivo con el código', () => {
    document.title = 'Consentimiento y envío'
    render(<HojaImpresion formulario={formulario} />)
    expect(screen.queryByText('Formulario de postulación')).not.toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('beforeprint')))
    expect(screen.getByText('Formulario de postulación')).toBeInTheDocument()
    expect(screen.getByText(/aún no se ha enviado/)).toBeInTheDocument()
    expect(document.title).toBe('Formulario BIESS-2026-000001')

    act(() => window.dispatchEvent(new Event('afterprint')))
    expect(screen.queryByText('Formulario de postulación')).not.toBeInTheDocument()
    expect(document.title).toBe('Consentimiento y envío')
  })

  it('una postulación enviada muestra cuándo se recibió', () => {
    render(<HojaImpresion formulario={{ ...formulario, estado: 'ENVIADA', fechaEnvio: '2026-11-04T03:32:00Z' }} />)
    act(() => window.dispatchEvent(new Event('beforeprint')))
    expect(screen.getByText(/recibida el/i)).toBeInTheDocument()
    act(() => window.dispatchEvent(new Event('afterprint')))
  })
})
