import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstalarApp } from './InstalarApp'

const ofrecerInstalacion = () => {
  const evento = new Event('beforeinstallprompt')
  evento.prompt = vi.fn().mockResolvedValue()
  evento.userChoice = Promise.resolve({ outcome: 'accepted' })
  act(() => window.dispatchEvent(evento))
  return evento
}

describe('InstalarApp', () => {
  afterEach(() => vi.restoreAllMocks())

  it('no aparece donde no se puede instalar', () => {
    const { container } = render(<InstalarApp />)
    expect(container).toBeEmptyDOMElement()
  })

  it('pide confirmar y no instala si la persona lo pospone', async () => {
    render(<InstalarApp />)
    const evento = ofrecerInstalacion()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar la app' }))
    expect(screen.getByRole('heading', { name: /descargar la app del directorio/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ahora no' }))
    expect(evento.prompt).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Descargar la app' })).toBeInTheDocument()
  })

  it('al confirmar abre la instalación del sistema y el botón desaparece', async () => {
    render(<InstalarApp />)
    const evento = ofrecerInstalacion()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar la app' }))
    await userEvent.click(screen.getByRole('button', { name: 'Descargar' }))
    expect(evento.prompt).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Descargar la app' })).not.toBeInTheDocument())
  })

  it('en iPhone explica los pasos, porque Safari no permite abrir la instalación', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    render(<InstalarApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Descargar la app' }))
    expect(screen.getByText(/agregar a inicio/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descargar' })).not.toBeInTheDocument()
  })
})
