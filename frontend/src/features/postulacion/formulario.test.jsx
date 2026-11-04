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

describe('datos personales: se corrigen una sola vez', () => {
  const sinConfirmar = () => postulacionBase({ datosConfirmadosEn: null })

  it('corrige la fecha, confirma y queda bloqueado', async () => {
    postulacionApi.obtener.mockResolvedValue(sinConfirmar())
    const base = sinConfirmar().datosPersonales
    postulacionApi.datosPersonales.mockResolvedValue(
      postulacionBase({ datosPersonales: { ...base, fechaNacimiento: '1990-06-15' } }),
    )
    const user = userEvent.setup()
    abrirFormulario()

    const fecha = await screen.findByLabelText(/fecha de nacimiento/i)
    expect(fecha).toHaveValue('1985-04-12')
    expect(screen.getByText(/solo podrá hacerlo una vez/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/nacionalidad/i)).not.toBeInTheDocument()

    await user.clear(fecha)
    await user.type(fecha, '1990-06-15')
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))
    expect(postulacionApi.datosPersonales).not.toHaveBeenCalled()

    await user.click(await screen.findByRole('button', { name: /sí, confirmar/i }))
    expect(postulacionApi.datosPersonales).toHaveBeenCalledWith(
      expect.objectContaining({ fechaNacimiento: '1990-06-15', nombres: 'María Fernanda', conyugeNombres: null, conyugeCedula: null }),
    )
    expect(await screen.findByText('Datos confirmados')).toBeInTheDocument()
    expect(screen.getByText('15/06/1990')).toBeInTheDocument()
    expect(screen.queryByLabelText(/fecha de nacimiento/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^guardar$/i })).not.toBeInTheDocument()
  })

  it('no deja confirmar a un menor de edad ni una fecha futura', async () => {
    postulacionApi.obtener.mockResolvedValue(sinConfirmar())
    const user = userEvent.setup()
    abrirFormulario()
    const fecha = await screen.findByLabelText(/fecha de nacimiento/i)
    await user.clear(fecha)
    await user.type(fecha, '2099-01-01')
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))
    expect(await screen.findByText(/no puede ser una fecha futura/i)).toBeInTheDocument()

    await user.clear(fecha)
    await user.type(fecha, `${new Date().getFullYear() - 10}-01-01`)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))
    expect(await screen.findByText(/mayor de edad/i)).toBeInTheDocument()
    expect(postulacionApi.datosPersonales).not.toHaveBeenCalled()
  })

  it('si está casada exige los datos del cónyuge', async () => {
    postulacionApi.obtener.mockResolvedValue(sinConfirmar())
    const user = userEvent.setup()
    abrirFormulario()
    await user.selectOptions(await screen.findByLabelText(/estado civil/i), 'CASADO/A')
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))
    expect(await screen.findByText(/cédula del cónyuge/i)).toBeInTheDocument()
    expect(postulacionApi.datosPersonales).not.toHaveBeenCalled()
  })

  it('una postulación enviada antes de esta regla sigue siendo de solo lectura', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase({ estado: 'ENVIADA', datosConfirmadosEn: null, fechaEnvio: '2026-01-15T10:00:00Z' }))
    abrirFormulario('personal')
    expect(await screen.findByText('12/04/1985')).toBeInTheDocument()
    expect(screen.queryByLabelText(/fecha de nacimiento/i)).not.toBeInTheDocument()
  })
})

describe('cambios sin guardar', () => {
  it('avisa antes de salir del folio y permite quedarse o descartar', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    const user = userEvent.setup()
    abrirFormulario('contacto')
    const calle = await screen.findByLabelText(/calle principal/i)
    await user.type(calle, 'Av. Solano')

    await user.click(screen.getByRole('button', { name: /ir al folio 1\.3/i }))
    expect(await screen.findByRole('heading', { name: /tiene cambios sin guardar/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /seguir editando/i }))
    expect(screen.getByLabelText(/calle principal/i)).toHaveValue('Av. Solano')

    await user.click(screen.getByRole('button', { name: /ir al folio 1\.3/i }))
    await user.click(await screen.findByRole('button', { name: /salir sin guardar/i }))
    await waitFor(() => expect(screen.queryByLabelText(/calle principal/i)).not.toBeInTheDocument())
  })

  it('sin cambios se mueve entre folios sin preguntar', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    const user = userEvent.setup()
    abrirFormulario('contacto')
    await screen.findByLabelText(/calle principal/i)
    await user.click(screen.getByRole('button', { name: /ir al folio 1\.3/i }))
    await waitFor(() => expect(screen.queryByLabelText(/calle principal/i)).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: /tiene cambios sin guardar/i })).not.toBeInTheDocument()
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
    const canton = screen.getByLabelText(/^ciudad/i)
    await waitFor(() => expect(within(canton).getByRole('option', { name: 'Cuenca' })).toBeInTheDocument())
    await user.selectOptions(canton, '1')
    expect(canton).toHaveValue('1')

    await user.selectOptions(provincia, '9') // otra provincia → el cantón se limpia
    expect(screen.getByLabelText(/^ciudad/i)).toHaveValue('')
    await waitFor(() => expect(catalogos.cantones).toHaveBeenCalledWith('9'))

    await user.selectOptions(pais, '59') // fuera de Ecuador → texto libre
    expect(screen.getByLabelText(/provincia \/ estado/i).tagName).toBe('INPUT')
    expect(screen.getByLabelText(/^ciudad/i).tagName).toBe('INPUT')
  })

  it('carga el correo registrado y, al guardar, deja Editar y Eliminar', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    abrirFormulario('contacto')
    expect(await screen.findByLabelText(/correo electrónico 1/i)).toHaveValue('maria@correo.com')
  })

  it('envía el domicilio con ids numéricos y avanza', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    postulacionApi.contacto.mockImplementation(async (body) => postulacionBase({ contacto: body }))
    const user = userEvent.setup()
    abrirFormulario('contacto')

    const provincia = await screen.findByLabelText(/^provincia/i)
    await waitFor(() => expect(within(provincia).getByRole('option', { name: 'Azuay' })).toBeInTheDocument())
    await user.selectOptions(provincia, '1')
    const canton = screen.getByLabelText(/^ciudad/i)
    await waitFor(() => expect(within(canton).getByRole('option', { name: 'Cuenca' })).toBeInTheDocument())
    await user.selectOptions(canton, '1')
    await user.type(screen.getByLabelText(/calle principal/i), 'Av. Solano')
    await user.type(screen.getByLabelText(/teléfono celular/i), '0991234567')
    await user.click(screen.getByRole('button', { name: /guardar progreso/i }))

    expect(await screen.findByText(/sección guardada/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
    expect(postulacionApi.contacto).toHaveBeenCalledWith(
      expect.objectContaining({ paisId: 52, provinciaId: 1, cantonId: 1, provinciaTexto: null, correo2: null }),
    )
  })
})

describe('cargo', () => {
  const cumple = { cumple: true, etiqueta: 'Postulante afiliado al IESS' }

  it('si no acredita la calidad muestra ✖ y no despliega la pregunta ni deja guardar', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    postulacionApi.validarCargo.mockResolvedValue({
      cumple: false,
      etiqueta: 'Postulante no acredita jubilación',
      mensaje: 'NO puede continuar, no acredita jubilación',
    })
    const user = userEvent.setup()
    abrirFormulario('cargo')

    await user.click(await screen.findByLabelText(/sector de los jubilados/i))

    expect(await screen.findByText('Postulante no acredita jubilación')).toBeInTheDocument()
    expect(screen.getByText('NO puede continuar, no acredita jubilación')).toBeInTheDocument()
    expect(postulacionApi.validarCargo).toHaveBeenCalledWith('JUBILADOS')
    expect(screen.queryByText(/respaldadas por una organización/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar postulación/i })).not.toBeInTheDocument()
  })

  it('la pregunta del respaldo aparece solo después de validar ✔', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    postulacionApi.validarCargo.mockResolvedValue(cumple)
    postulacionApi.cargo.mockResolvedValue(postulacionBase({ sectorCodigo: 'AFILIADOS', tieneRespaldo: false }))
    const user = userEvent.setup()
    abrirFormulario('cargo')

    await user.click(await screen.findByLabelText(/sector de afiliados/i))
    expect(await screen.findByText('Postulante afiliado al IESS')).toBeInTheDocument()
    expect(screen.getByText(/respaldadas por una organización de trabajadores/i)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'No' }))
    await user.click(screen.getByRole('button', { name: /guardar postulación/i }))
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(postulacionApi.cargo).toHaveBeenCalledWith(
      { sector: 'AFILIADOS', tieneRespaldo: false, organizacionNombre: null, organizacionDocumentoId: null },
    )
  })

  it('con respaldo exige el nombre y el PDF, y lo sube con su categoría', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    postulacionApi.validarCargo.mockResolvedValue(cumple)
    postulacionApi.subirDocumento.mockResolvedValue({ id: 9, categoria: 'RESPALDO_ORG', nombre: 'acta.pdf', tamanoBytes: 2048 })
    postulacionApi.cargo.mockResolvedValue(postulacionBase({ sectorCodigo: 'AFILIADOS', tieneRespaldo: true, organizacionNombre: 'FUT', organizacionDocumento: { id: 9, nombre: 'acta.pdf', tamanoBytes: 2048 } }))
    const user = userEvent.setup()
    abrirFormulario('cargo')

    await user.click(await screen.findByLabelText(/sector de afiliados/i))
    await user.click(await screen.findByRole('radio', { name: 'Sí' }))
    await user.click(screen.getByRole('button', { name: /guardar postulación/i }))
    expect(await screen.findByText(/adjunte el documento de respaldo/i)).toBeInTheDocument()
    expect(postulacionApi.cargo).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/nombre de organización/i), 'FUT')
    const archivo = new File(['%PDF-1.4'], 'acta.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText(/máximo 4 MB/i), archivo)
    expect(await screen.findByText('acta.pdf')).toBeInTheDocument()
    expect(postulacionApi.subirDocumento).toHaveBeenCalledWith('RESPALDO_ORG', archivo)

    await user.click(screen.getByRole('button', { name: /guardar postulación/i }))
    await screen.findByRole('button', { name: 'Editar' })
    expect(postulacionApi.cargo).toHaveBeenCalledWith(
      { sector: 'AFILIADOS', tieneRespaldo: true, organizacionNombre: 'FUT', organizacionDocumentoId: 9 },
    )
  })

  it('Eliminar quita el cargo guardado tras confirmar', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase({ sectorCodigo: 'AFILIADOS', tieneRespaldo: false }))
    postulacionApi.eliminarCargo.mockResolvedValue(postulacionBase())
    const user = userEvent.setup()
    abrirFormulario('cargo')

    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(postulacionApi.eliminarCargo).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: /sí, eliminar/i }))
    expect(await screen.findByLabelText(/sector de afiliados/i)).not.toBeChecked()
    expect(postulacionApi.eliminarCargo).toHaveBeenCalledTimes(1)
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
