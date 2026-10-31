import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogos } from '../../api/catalogos'
import { ApiError } from '../../api/client'
import { postulacionApi } from '../../api/postulacion'
import { abrirFormulario, mockCatalogos, postulacionBase } from './test-utils'

vi.mock('../../api/postulacion')
vi.mock('../../api/catalogos')

beforeEach(() => {
  vi.resetAllMocks()
  mockCatalogos()
})

describe('inicio y cierre de la postulación', () => {
  it('sin postulación ofrece iniciarla y, si es extranjero, muestra la pantalla de cierre', async () => {
    const motivo = 'Su postulación no puede continuar: se requiere ser de nacionalidad ecuatoriana'
    postulacionApi.obtener
      .mockRejectedValueOnce(new ApiError({ status: 404, code: 'NO_ENCONTRADO', message: 'Aún no ha iniciado' }))
      .mockResolvedValueOnce(postulacionBase({ estado: 'CERRADA', motivoCierre: motivo, codigo: 'BIESS-2026-000001' }))
    postulacionApi.crear.mockRejectedValue(
      new ApiError({ status: 422, code: 'REGLA_NEGOCIO', message: motivo, details: { estado: 'CERRADA' } }),
    )
    const user = userEvent.setup()
    abrirFormulario()

    await user.click(await screen.findByRole('button', { name: /iniciar mi postulación/i }))
    expect(await screen.findByRole('heading', { name: /postulación cerrada/i })).toBeInTheDocument()
    expect(screen.getByText(motivo)).toBeInTheDocument()
    expect(screen.getByText('BIESS-2026-000001')).toBeInTheDocument()
  })

  it('muestra los datos personales de solo lectura y el código', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    abrirFormulario()
    expect(await screen.findByText('BIESS-2026-000002')).toBeInTheDocument()
    expect(screen.getByText('12/04/1985')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar progreso/i })).not.toBeInTheDocument()
  })
})

describe('domicilio: cascada País → Provincia → Cantón', () => {
  it('carga los hijos al elegir el padre y los limpia al cambiarlo', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    const user = userEvent.setup()
    abrirFormulario('contacto')

    const pais = await screen.findByLabelText(/^país/i)
    await waitFor(() => expect(pais).toHaveValue('52')) // Ecuador por defecto
    const provincia = await screen.findByLabelText(/^provincia/i)
    await waitFor(() => expect(within(provincia).getByRole('option', { name: 'Azuay' })).toBeInTheDocument())

    await user.selectOptions(provincia, '1')
    const canton = screen.getByLabelText(/^cantón/i)
    await waitFor(() => expect(within(canton).getByRole('option', { name: 'Cuenca' })).toBeInTheDocument())
    await user.selectOptions(canton, '1')
    expect(canton).toHaveValue('1')

    await user.selectOptions(provincia, '9') // otra provincia → el cantón se limpia
    expect(screen.getByLabelText(/^cantón/i)).toHaveValue('')
    await waitFor(() => expect(catalogos.cantones).toHaveBeenCalledWith('9'))

    await user.selectOptions(pais, '59') // fuera de Ecuador → texto libre
    expect(screen.queryByLabelText(/^cantón/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/provincia \/ estado/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^ciudad/i)).toBeInTheDocument()
  })

  it('envía el domicilio con ids numéricos y avanza', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    postulacionApi.contacto.mockImplementation(async (body) => postulacionBase({ contacto: body }))
    const user = userEvent.setup()
    abrirFormulario('contacto')

    const provincia = await screen.findByLabelText(/^provincia/i)
    await waitFor(() => expect(within(provincia).getByRole('option', { name: 'Azuay' })).toBeInTheDocument())
    await user.selectOptions(provincia, '1')
    const canton = screen.getByLabelText(/^cantón/i)
    await waitFor(() => expect(within(canton).getByRole('option', { name: 'Cuenca' })).toBeInTheDocument())
    await user.selectOptions(canton, '1')
    await user.type(screen.getByLabelText(/calle principal/i), 'Av. Solano')
    await user.type(screen.getByLabelText(/teléfono celular/i), '0991234567')
    await user.type(screen.getByLabelText(/correo electrónico principal/i), 'maria@correo.com')
    await user.click(screen.getByRole('button', { name: /guardar progreso/i }))

    expect(await screen.findByText(/sección guardada/i)).toBeInTheDocument()
    expect(postulacionApi.contacto).toHaveBeenCalledWith(
      expect.objectContaining({ paisId: 52, provinciaId: 1, cantonId: 1, provinciaTexto: null, correo2: null }),
    )
  })
})

describe('cargo', () => {
  it('muestra ✖ con el mensaje del backend si no acredita la calidad', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    postulacionApi.cargo.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'REGLA_NEGOCIO',
        message: 'NO puede continuar, no acredita jubilación',
        details: { cumple: false, etiqueta: 'Postulante no acredita jubilación' },
      }),
    )
    const user = userEvent.setup()
    abrirFormulario('cargo')

    await user.click(await screen.findByLabelText(/sector de los jubilados/i))
    await user.click(screen.getByRole('radio', { name: 'No' }))
    await user.click(screen.getByRole('button', { name: /guardar progreso/i }))

    expect(await screen.findByText('Postulante no acredita jubilación')).toBeInTheDocument()
    expect(screen.getByText('NO puede continuar, no acredita jubilación')).toBeInTheDocument()
  })

  it('muestra ✔ cuando el cargo se valida', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    postulacionApi.cargo.mockResolvedValue(postulacionBase({ sectorCodigo: 'AFILIADOS', tieneRespaldo: false }))
    const user = userEvent.setup()
    abrirFormulario('cargo')

    await user.click(await screen.findByLabelText(/sector de afiliados/i))
    await user.click(screen.getByRole('radio', { name: 'No' }))
    await user.click(screen.getByRole('button', { name: /guardar progreso/i }))
    expect(await screen.findByText('Postulante afiliado al IESS')).toBeInTheDocument()
  })
})

describe('familiares', () => {
  it('al responder Sí agrega un registro y valida sus campos', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    const user = userEvent.setup()
    abrirFormulario('familiares')

    await user.click(await screen.findByRole('radio', { name: 'Sí' }))
    expect(screen.getByText('Familiar 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /guardar progreso/i }))
    expect(await screen.findAllByText('Es obligatorio')).not.toHaveLength(0)
    expect(postulacionApi.familiares).not.toHaveBeenCalled()
  })
})
