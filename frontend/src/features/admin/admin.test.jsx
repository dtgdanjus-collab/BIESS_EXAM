import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminApi } from '../../api/admin'
import { ApiError } from '../../api/client'
import { catalogos } from '../../api/catalogos'
import { AppRouter } from '../../routes/AppRouter'
import { useAdminStore } from '../../store/adminStore'
import { leerPreguntasCsv } from './AdminConcurso'

vi.mock('../../api/admin')
vi.mock('../../api/catalogos')

const sesion = (rol) =>
  useAdminStore.getState().login({
    token: 'jwt',
    expiraEn: new Date(Date.now() + 3_600_000).toISOString(),
    admin: { id: 1, usuario: 'ana', nombre: 'Ana Admin', rol },
  })

const abrir = (ruta) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <AppRouter />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.resetAllMocks()
  useAdminStore.getState().logout()
  catalogos.sectores.mockResolvedValue([])
})

describe('acceso', () => {
  it('sin sesión lleva al ingreso y muestra el mensaje de credenciales', async () => {
    adminApi.login.mockRejectedValue(
      new ApiError({ status: 401, code: 'CREDENCIALES', message: 'Sus credenciales de ingreso son incorrectas', details: { intentosRestantes: 2 } }),
    )
    const user = userEvent.setup()
    abrir('/admin')
    await user.type(await screen.findByLabelText(/usuario/i), 'ana')
    await user.type(screen.getByLabelText(/contraseña/i), 'mala')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByText(/credenciales de ingreso son incorrectas/i)).toBeInTheDocument()
  })

  it('el analista no ve los apartados del administrador', async () => {
    sesion('ANALISTA')
    adminApi.dashboard.mockResolvedValue({ cargos: [], sinCargo: 0, cerradas: 0, posibleInhabilidad: 0, cuentas: 0, generado: new Date().toISOString() })
    abrir('/admin')
    expect(await screen.findByRole('link', { name: 'Postulantes' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Fases' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Banco de preguntas' })).not.toBeInTheDocument()
  })
})

describe('panel', () => {
  it('muestra los postulantes por cargo', async () => {
    sesion('ADMINISTRADOR')
    adminApi.dashboard.mockResolvedValue({
      cargos: [{ sectorCodigo: 'AFILIADOS', cargo: 'Sector de Afiliados', enviadas: 7, borradores: 2 }],
      sinCargo: 0, cerradas: 1, posibleInhabilidad: 3, cuentas: 12, generado: new Date().toISOString(),
    })
    abrir('/admin')
    expect(await screen.findByText('Sector de Afiliados')).toBeInTheDocument()
    expect(screen.getAllByText('7').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Ver nómina' })).toHaveAttribute('href', '/admin/postulantes?sector=AFILIADOS')
  })
})

describe('nómina', () => {
  it('filtra y exporta', async () => {
    sesion('ANALISTA')
    adminApi.postulantes.mockResolvedValue([
      { postulacionId: 5, codigo: 'BIESS-2026-000005', estado: 'ENVIADA', sectorCodigo: 'AFILIADOS', cedula: '0102345675', nombres: 'María', apellidos: 'Ortega', posibleInhabilidad: true, estadoConcurso: 'POSTULADO', puntajeMeritos: null, notaTeorica: 88.5, notaPsicotecnica: null },
    ])
    adminApi.matrizXlsx.mockResolvedValue(new Blob(['x']))
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x')
    globalThis.URL.revokeObjectURL = vi.fn()
    const user = userEvent.setup()
    abrir('/admin/postulantes')
    expect(await screen.findByText(/Ortega María/)).toBeInTheDocument()
    expect(screen.getByText('88.50')).toBeInTheDocument()
    expect(screen.getByText('Posible inhabilidad', { selector: 'span' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Buscar'), '0102')
    await waitFor(() => expect(adminApi.postulantes).toHaveBeenLastCalledWith(expect.objectContaining({ q: '0102' })))
    await user.click(screen.getByRole('button', { name: 'Exportar Excel' }))
    await waitFor(() => expect(adminApi.matrizXlsx).toHaveBeenCalledWith(expect.objectContaining({ q: '0102' })))
  })
})

describe('banco de preguntas', () => {
  it('lee un CSV y convierte la opción correcta a índice', () => {
    expect(leerPreguntasCsv('¿2+2?;3;4;5;2\n\n¿Capital?;Quito;Lima;1\r\n')).toEqual([
      { enunciado: '¿2+2?', opciones: ['3', '4', '5'], correcta: 1, activa: true },
      { enunciado: '¿Capital?', opciones: ['Quito', 'Lima'], correcta: 0, activa: true },
    ])
  })

  it('un CSV mal formado dice qué línea corregir', () => {
    expect(() => leerPreguntasCsv('¿Bien?;a;b;1\n¿Mal?;a;b;9')).toThrow(/Línea 2/)
    expect(() => leerPreguntasCsv('solo texto')).toThrow(/Línea 1/)
  })
})
