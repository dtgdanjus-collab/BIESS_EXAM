import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvisosApp } from './AvisosApp'

const sw = vi.hoisted(() => ({ hay: false, actualizar: vi.fn(), posponer: vi.fn() }))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [sw.hay, sw.posponer], updateServiceWorker: sw.actualizar }),
}))

const abrir = (ruta = '/formulario') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <AvisosApp />
    </MemoryRouter>,
  )

const conexion = (valor) => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(valor)
  act(() => window.dispatchEvent(new Event(valor ? 'online' : 'offline')))
}

describe('AvisosApp', () => {
  beforeEach(() => {
    sw.hay = false
    sw.actualizar.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('con conexión y sin versión nueva no muestra nada', () => {
    const { container } = abrir()
    expect(container).toBeEmptyDOMElement()
  })

  it('avisa al perder la conexión y deja de hacerlo al recuperarla', () => {
    abrir()
    conexion(false)
    expect(screen.getByRole('status')).toHaveTextContent(/sin conexión/i)
    conexion(true)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('pregunta antes de actualizar y solo actualiza si la persona acepta', async () => {
    sw.hay = true
    abrir()
    expect(sw.actualizar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(sw.actualizar).toHaveBeenCalledWith(true)
  })

  it('no ofrece actualizar durante el examen', () => {
    sw.hay = true
    abrir('/evaluacion')
    expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument()
  })
})
