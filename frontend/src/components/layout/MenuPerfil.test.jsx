import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../store/authStore'
import { MenuPerfil } from './MenuPerfil'

const integrantes = vi.hoisted(() => ({ lista: [] }))
vi.mock('../../config/integrantes', () => ({
  get INTEGRANTES() {
    return integrantes.lista
  },
  ASIGNATURA: 'Frameworks de Programación Web',
  EVALUACION: 'Examen práctico',
}))

const abrir = () =>
  render(
    <MemoryRouter>
      <MenuPerfil />
    </MemoryRouter>,
  )

describe('MenuPerfil', () => {
  beforeEach(() => {
    integrantes.lista = []
    useAuthStore.getState().login({
      token: 'jwt',
      expiraEn: new Date(Date.now() + 3_600_000).toISOString(),
      usuario: { cedula: '0102345675', email: 'maria@correo.com', nombres: 'María', apellidos: 'Ortega' },
    })
  })

  it('se abre con clic, muestra el correo y el estado vacío de integrantes', async () => {
    const user = userEvent.setup()
    abrir()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ver perfil de maría ortega/i }))
    const panel = screen.getByRole('dialog', { name: /perfil del usuario/i })
    expect(within(panel).getByText('maria@correo.com')).toBeInTheDocument()
    expect(within(panel).getByRole('heading', { name: /integrantes del grupo/i })).toBeInTheDocument()
    expect(within(panel).getByText(/aparecerán aquí/i)).toBeInTheDocument()
  })

  it('lista a los integrantes configurados con sus iniciales', async () => {
    integrantes.lista = ['Ana Pérez', 'Luis Mora']
    const user = userEvent.setup()
    abrir()
    await user.click(screen.getByRole('button', { name: /ver perfil/i }))
    const panel = screen.getByRole('dialog')
    expect(within(panel).getByText('Ana Pérez')).toBeInTheDocument()
    expect(within(panel).getByText('LM')).toBeInTheDocument()
    expect(within(panel).queryByText(/aparecerán aquí/i)).not.toBeInTheDocument()
  })

  it('se cierra con Escape y al hacer clic fuera', async () => {
    const user = userEvent.setup()
    abrir()
    const boton = screen.getByRole('button', { name: /ver perfil/i })
    await user.click(boton)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(boton).toHaveFocus()

    await user.click(boton)
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
