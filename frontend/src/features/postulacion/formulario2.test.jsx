import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catalogos } from '../../api/catalogos'
import { ApiError } from '../../api/client'
import { postulacionApi } from '../../api/postulacion'
import { abrirFormulario, mockCatalogos, postulacionBase } from './test-utils'

vi.mock('../../api/postulacion')
vi.mock('../../api/catalogos')

const PREGUNTAS = [
  { id: 1, numeral: '1.9.1', texto: '¿Es ecuatoriano?', respuestaEsperada: true, requiereDetalle: false, orden: 1 },
  { id: 7, numeral: '1.9.7', texto: '¿Ha sido removido por un Organismo de Control?', respuestaEsperada: false, requiereDetalle: true, orden: 7 },
]

const completa = (cambios = {}) =>
  postulacionBase({
    contacto: { paisId: 52, provinciaId: 1, cantonId: 1, telefonoCelular: '0991234567', correo1: 'maria@correo.com', callePrincipal: 'Av. Solano' },
    tieneFamiliares: false,
    sectorCodigo: 'AFILIADOS',
    tieneRespaldo: false,
    formacion: [{ id: 1, nivelId: 3, institucion: 'U. de Cuenca', tipo: 'NACIONAL', titulo: 'Magíster', areaId: 1, registroSenescyt: '1031-1', fechaRegistro: '2015-08-20' }],
    experiencia: [{ id: 1, tipo: 'GENERAL', cargo: 'Analista', institucion: 'Banco', fechaInicio: '2010-01-01', fechaFin: '2014-12-31', areaId: 1, descripcion: 'x', documentoId: 5, documentoNombre: 'certificado.pdf', documentoTamano: 2048, duracion: { anios: 5, meses: 0, dias: 0 } }],
    experienciaTotal: { general: { anios: 5, meses: 0, dias: 0 }, direccion: { anios: 0, meses: 0, dias: 0 }, total: { anios: 5, meses: 0, dias: 0 } },
    tienePublicaciones: false,
    inhabilidades: [{ preguntaId: 1, respuesta: true, detalle: null }],
    ...cambios,
  })

beforeEach(() => {
  vi.resetAllMocks()
  mockCatalogos()
  catalogos.inhabilidades.mockResolvedValue(PREGUNTAS)
})

describe('experiencia', () => {
  it('calcula en vivo la duración de cada registro y el total', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    const user = userEvent.setup()
    abrirFormulario('experiencia')

    await user.click(await screen.findByRole('button', { name: /agregar experiencia/i }))
    await user.type(screen.getByLabelText(/fecha inicio/i), '2020-01-01')
    await user.type(screen.getByLabelText(/fecha finalización/i), '2021-02-01')
    // aparece en el registro y en el total (sin tipo elegido aún no suma a "General")
    expect(screen.getAllByText('1 año, 1 mes y 1 día')).toHaveLength(2)
    const totales = screen.getByText(/experiencia acumulada/i).parentElement
    expect(within(totales).getByText('Total').nextSibling).toHaveTextContent('1 año, 1 mes y 1 día')
  })

  it('no permite una fecha de fin anterior a la de inicio', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    const user = userEvent.setup()
    abrirFormulario('experiencia')
    await user.click(await screen.findByRole('button', { name: /agregar experiencia/i }))
    await user.type(screen.getByLabelText(/fecha inicio/i), '2021-01-01')
    await user.type(screen.getByLabelText(/fecha finalización/i), '2020-01-01')
    await user.click(screen.getByRole('button', { name: /guardar progreso/i }))
    expect(await screen.findByText(/posterior o igual a la fecha de inicio/i)).toBeInTheDocument()
    expect(postulacionApi.experiencia).not.toHaveBeenCalled()
  })
})

describe('documentos de respaldo', () => {
  const pdf = (bytes, nombre = 'doc.pdf') => {
    const f = new File(['%PDF-'], nombre, { type: 'application/pdf' })
    Object.defineProperty(f, 'size', { value: bytes })
    return f
  }

  it('la experiencia exige su PDF al guardar', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    const user = userEvent.setup()
    abrirFormulario('experiencia')
    await user.click(await screen.findByRole('button', { name: /agregar experiencia/i }))
    await user.click(screen.getByRole('button', { name: /guardar progreso/i }))
    expect(await screen.findByText(/adjunte el documento de respaldo/i)).toBeInTheDocument()
    expect(postulacionApi.experiencia).not.toHaveBeenCalled()
  })

  it('en la formación el PDF es opcional y rechaza más de 2 MB sin subirlo', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    const user = userEvent.setup()
    abrirFormulario('formacion')
    await user.click(await screen.findByRole('button', { name: /agregar título/i }))
    await user.upload(screen.getByLabelText(/máximo 2 MB/i), pdf(2 * 1024 * 1024 + 1))
    expect(await screen.findByText(/supera el máximo de 2 MB/i)).toBeInTheDocument()
    expect(postulacionApi.subirDocumento).not.toHaveBeenCalled()
  })

  it('muestra el error del servidor si el archivo no es un PDF real', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    postulacionApi.subirDocumento.mockRejectedValue(
      new ApiError({ status: 400, code: 'VALIDACION', message: 'Revise', details: { campos: { archivo: 'El documento debe estar en formato PDF' } } }),
    )
    const user = userEvent.setup()
    abrirFormulario('capacitacion')
    await user.click(await screen.findByRole('button', { name: /agregar capacitación/i }))
    await user.upload(screen.getByLabelText(/máximo 2 MB/i), pdf(100))
    expect(await screen.findByText(/debe estar en formato PDF/i)).toBeInTheDocument()
  })

  it('un registro guardado se ve cerrado con Editar y Eliminar, y al editar conserva su PDF', async () => {
    const p = completa()
    postulacionApi.obtener.mockResolvedValue(p)
    postulacionApi.experiencia.mockResolvedValue(p)
    const user = userEvent.setup()
    abrirFormulario('experiencia')

    const editar = await screen.findByRole('button', { name: 'Editar Experiencia 1' })
    expect(screen.getByRole('button', { name: 'Eliminar Experiencia 1' })).toBeInTheDocument()
    expect(screen.getByText('Analista · Banco')).toBeInTheDocument()
    // jsdom no carga Tailwind: lo plegado se comprueba por su clase.
    expect(screen.getByLabelText(/cargo o puesto/i).closest('.hidden')).not.toBeNull()

    await user.click(editar)
    expect(screen.getByLabelText(/cargo o puesto/i).closest('.hidden')).toBeNull()
    expect(screen.getByText('certificado.pdf')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /guardar progreso/i }))
    expect(await screen.findByText(/sección guardada/i)).toBeInTheDocument()
    expect(postulacionApi.experiencia.mock.calls[0][0][0].documentoId).toBe(5)
    expect(screen.getByRole('button', { name: 'Editar Experiencia 1' })).toBeInTheDocument()
  })

  it('una experiencia sin su PDF deja pendiente el envío', async () => {
    const p = completa()
    p.experiencia[0].documentoId = null
    postulacionApi.obtener.mockResolvedValue(p)
    abrirFormulario('envio')
    expect(await screen.findByText(/complete las siguientes secciones/i)).toBeInTheDocument()
  })
})

describe('inhabilidades', () => {
  it('la 1.9.7 en "Sí" despliega y exige el detalle de la remoción', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    postulacionApi.inhabilidades.mockResolvedValue(postulacionBase({ posibleInhabilidad: true }))
    const user = userEvent.setup()
    abrirFormulario('inhabilidades')

    const p1 = (await screen.findByText('¿Es ecuatoriano?')).closest('fieldset')
    const p7 = screen.getByText(/removido por un Organismo/).closest('fieldset')
    await user.click(within(p1).getByRole('radio', { name: 'Sí' }))
    await user.click(within(p7).getByRole('radio', { name: 'Sí' }))
    expect(screen.getByText(/detalle de la remoción/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /guardar progreso/i }))
    expect(await screen.findAllByText('Es obligatorio')).toHaveLength(3)
    expect(postulacionApi.inhabilidades).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/^institución/i), 'Superintendencia de Bancos')
    await user.type(screen.getByLabelText(/^cargo/i), 'Gerente')
    await user.type(screen.getByLabelText(/fecha de fin de funciones/i), '2022-06-30')
    await user.type(screen.getByLabelText(/^motivo/i), 'Remoción administrativa')
    await user.click(screen.getByRole('button', { name: /guardar progreso/i }))

    expect(await screen.findByText(/sección guardada/i)).toBeInTheDocument()
    expect(postulacionApi.inhabilidades).toHaveBeenCalledWith([
      { preguntaId: 1, respuesta: true, detalle: null },
      {
        preguntaId: 7,
        respuesta: true,
        detalle: { institucion: 'Superintendencia de Bancos', cargo: 'Gerente', fechaFin: '2022-06-30', motivo: 'Remoción administrativa' },
      },
    ])
  })
})

describe('envío', () => {
  it('bloquea el envío si faltan secciones obligatorias', async () => {
    postulacionApi.obtener.mockResolvedValue(postulacionBase())
    const user = userEvent.setup()
    abrirFormulario('envio')
    expect(await screen.findByText(/complete las siguientes secciones/i)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: /enviar postulación/i })).toBeDisabled()
  })

  it('exige el consentimiento, confirma y muestra el comprobante con el código', async () => {
    postulacionApi.obtener.mockResolvedValue(completa())
    postulacionApi.enviar.mockResolvedValue(completa({ estado: 'ENVIADA', fechaEnvio: '2026-10-30T22:49:05-05:00' }))
    const user = userEvent.setup()
    abrirFormulario('envio')

    const boton = await screen.findByRole('button', { name: /enviar postulación/i })
    expect(boton).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(boton)
    await user.click(await screen.findByRole('button', { name: /sí, enviar/i }))

    expect(await screen.findByText(/comprobante de postulación/i)).toBeInTheDocument()
    expect(postulacionApi.enviar).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('BIESS-2026-000002').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /imprimir comprobante/i })).toBeInTheDocument()
  })
})
