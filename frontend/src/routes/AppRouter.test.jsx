import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../store/authStore'
import { AppRouter } from './AppRouter'

const enRuta = (ruta) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <AppRouter />
    </MemoryRouter>,
  )

const sesion = (expiraEn) =>
  useAuthStore.getState().login({
    token: 'jwt',
    expiraEn,
    usuario: { id: 1, cedula: '0102345675', nombres: 'María', apellidos: 'Ortega' },
  })

describe('rutas protegidas', () => {
  beforeEach(() => useAuthStore.getState().logout())

  it('sin sesión, /formulario redirige a /login', async () => {
    enRuta('/formulario')
    expect(await screen.findByRole('heading', { name: /login|iniciar sesión/i })).toBeInTheDocument()
  })

  it('con el token vencido también redirige a /login', async () => {
    sesion(new Date(Date.now() - 60_000).toISOString())
    enRuta('/formulario')
    expect(await screen.findByRole('heading', { name: /login|iniciar sesión/i })).toBeInTheDocument()
  })

  it('con sesión válida muestra el formulario y el nombre del usuario', async () => {
    sesion(new Date(Date.now() + 3_600_000).toISOString())
    enRuta('/formulario')
    expect(await screen.findByText(/María Ortega/)).toBeInTheDocument()
  })

  it('con sesión, /login lleva al formulario', async () => {
    sesion(new Date(Date.now() + 3_600_000).toISOString())
    enRuta('/login')
    expect(await screen.findByText(/María Ortega/)).toBeInTheDocument()
  })
})
