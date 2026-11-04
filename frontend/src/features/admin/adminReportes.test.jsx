import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminApi } from '../../api/admin'
import { catalogos } from '../../api/catalogos'
import { AppRouter } from '../../routes/AppRouter'
import { useAdminStore } from '../../store/adminStore'

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

const fila = (extra) => ({ postulacionId: 5, cargo: 'Sector de Afiliados', puesto: 1, apellidos: 'Ortega', nombres: 'María', cedula: '0102345675', puntajeMeritos: 90, notaTeorica: 80, notaPsicotecnica: 70, total: 80, posibleInhabilidad: false, ...extra })

const reconsideracion = (extra) => ({ id: 9, nombres: 'María Ortega', codigo: 'BIESS-1', cedula: '0102345675', etapa: 'MERITOS', motivo: 'Revisar', estado: 'PENDIENTE', responderAntes: '2099-01-10T00:00:00Z', informeAntes: '2099-01-05T00:00:00Z', ...extra })

beforeEach(() => {
  vi.resetAllMocks()
  useAdminStore.getState().logout()
  catalogos.sectores.mockResolvedValue([])
  catalogos.niveles.mockResolvedValue([{ id: 1, nombre: 'Tercer Nivel de Grado' }])
})

describe('lista de elegibles', () => {
  it('agrupa por cargo, avisa lo pendiente y exporta', async () => {
    sesion('ANALISTA')
    adminApi.elegibles.mockResolvedValue({ filas: [fila({ posibleInhabilidad: true })], pendientes: 2, bajoMinimo: 1, notaMinima: 70, pesos: [0, 0, 0] })
    adminApi.elegiblesPdf.mockResolvedValue(new Blob(['x']))
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x')
    globalThis.URL.revokeObjectURL = vi.fn()
    const user = userEvent.setup()
    abrir('/admin/elegibles')
    expect(await screen.findByRole('heading', { name: 'Sector de Afiliados' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ortega María' })).toBeInTheDocument()
    expect(screen.getByText('Posible inhabilidad')).toBeInTheDocument()
    expect(screen.getByText(/2 postulantes superaron/)).toBeInTheDocument()
    expect(screen.getByText(/1 postulantes no alcanzan/)).toBeInTheDocument()
    expect(screen.getByText(/las tres fases pesan igual/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Exportar PDF' }))
    await waitFor(() => expect(adminApi.elegiblesPdf).toHaveBeenCalled())
  })

  it('sin notas lo dice en vez de mostrar una tabla vacía', async () => {
    sesion('ADMINISTRADOR')
    adminApi.elegibles.mockResolvedValue({ filas: [], pendientes: 0, bajoMinimo: 0, notaMinima: 0, pesos: [0, 0, 0] })
    abrir('/admin/elegibles')
    expect(await screen.findByText(/aún no hay postulantes con las tres notas/i)).toBeInTheDocument()
  })
})

describe('tabla de puntajes', () => {
  it('guarda los valores como números y calcula los méritos', async () => {
    sesion('ADMINISTRADOR')
    adminApi.concurso.mockResolvedValue({ config: { tablaMeritos: { puntosPorNivel: null } }, fases: [] })
    adminApi.guardarTablaMeritos.mockResolvedValue({})
    adminApi.recalcularMeritos.mockResolvedValue({ calculadas: 3 })
    const user = userEvent.setup()
    abrir('/admin/puntajes')
    await user.type(await screen.findByLabelText(/puntos por título: tercer nivel/i), '10')
    await user.type(screen.getByLabelText(/nota mínima/i), '70')
    await user.click(screen.getByRole('button', { name: 'Guardar tabla' }))
    await waitFor(() => expect(adminApi.guardarTablaMeritos).toHaveBeenCalledWith(expect.objectContaining({ notaMinima: 70, puntosHora: 0, puntosPorNivel: { 1: 10 } })))
    await user.click(screen.getByRole('button', { name: 'Calcular méritos' }))
    expect(await screen.findByText(/se calcularon 3 postulaciones/i)).toBeInTheDocument()
  })

  it('el analista no ve Puntajes ni Bitácora, pero sí Elegibles', async () => {
    sesion('ANALISTA')
    adminApi.dashboard.mockResolvedValue({ cargos: [], sinCargo: 0, cerradas: 0, posibleInhabilidad: 0, cuentas: 0, generado: new Date().toISOString() })
    abrir('/admin')
    expect(await screen.findByRole('link', { name: 'Elegibles' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Puntajes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bitácora' })).not.toBeInTheDocument()
  })
})

describe('bitácora', () => {
  it('muestra quién hizo qué y busca', async () => {
    sesion('ADMINISTRADOR')
    adminApi.bitacora.mockResolvedValue([{ creadoEn: '2026-11-03T10:00:00Z', actor: 'Ana Admin', rol: 'ADMINISTRADOR', accion: 'CAMBIAR_FASE', detalle: 'codigo=MERITOS', codigo: null }])
    const user = userEvent.setup()
    abrir('/admin/bitacora')
    expect(await screen.findByText('Cambió una fase')).toBeInTheDocument()
    expect(screen.getByText('codigo=MERITOS')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Buscar'), 'ana')
    await waitFor(() => expect(adminApi.bitacora).toHaveBeenLastCalledWith({ q: 'ana' }))
  })
})

describe('reconsideraciones por actor', () => {
  it('Talento Humano informa, pero no resuelve', async () => {
    sesion('ANALISTA')
    adminApi.reconsideraciones.mockResolvedValue([reconsideracion()])
    adminApi.informarReconsideracion.mockResolvedValue({})
    const user = userEvent.setup()
    abrir('/admin/reconsideraciones')
    expect(await screen.findByText(/informe de talento humano antes del/i)).toBeInTheDocument()
    expect(screen.getByText(/resolución de la comisión antes del/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/^informe/i), 'Se revisó')
    await user.click(screen.getByRole('button', { name: 'Guardar informe' }))
    await waitFor(() => expect(adminApi.informarReconsideracion).toHaveBeenCalledWith(9, { informe: 'Se revisó' }))
  })

  it('la Comisión ve el informe y resuelve', async () => {
    sesion('ADMINISTRADOR')
    adminApi.reconsideraciones.mockResolvedValue([reconsideracion({ informe: 'Procede revisar', informePor: 'Analista' })])
    adminApi.responderReconsideracion.mockResolvedValue({})
    const user = userEvent.setup()
    abrir('/admin/reconsideraciones')
    expect(await screen.findByText(/procede revisar/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^respuesta/i), 'Se acepta')
    await user.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(adminApi.responderReconsideracion).toHaveBeenCalledWith(9, { estado: 'ACEPTADA', respuesta: 'Se acepta' }))
  })
})

describe('política de privacidad', () => {
  it('es pública y aclara que no es un servicio oficial', async () => {
    abrir('/privacidad')
    expect(await screen.findByRole('heading', { name: 'Política de privacidad', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/no es un servicio oficial del iess ni del biess/i)).toBeInTheDocument()
  })
})
