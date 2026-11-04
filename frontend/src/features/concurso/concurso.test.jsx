import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { evaluacionApi, postulacionApi } from '../../api/postulacion'
import { AppRouter } from '../../routes/AppRouter'
import { useAuthStore } from '../../store/authStore'

vi.mock('../../api/postulacion')

const abrir = (ruta) => {
  useAuthStore.getState().login({
    token: 'jwt',
    expiraEn: new Date(Date.now() + 3_600_000).toISOString(),
    usuario: { id: 1, cedula: '0102345675', email: 'maria@correo.com', nombres: 'María', apellidos: 'Ortega' },
  })
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AppRouter />
    </MemoryRouter>,
  )
}

const pregunta = (orden) => ({ orden, enunciado: `Pregunta número ${orden}`, opciones: ['Uno', 'Dos'] })
const enCurso = (cambios = {}) => ({ estado: 'EN_CURSO', habilitada: true, total: 2, respondidas: 0, segundosRestantes: 600, pregunta: pregunta(1), ...cambios })
const finalizada = { estado: 'FINALIZADA', total: 2, correctas: 1, nota: 50, forzado: false }

beforeEach(() => vi.resetAllMocks())
afterEach(() => vi.useRealTimers())

describe('evaluación técnica', () => {
  it('quien no superó méritos no la ve', async () => {
    evaluacionApi.estado.mockRejectedValue(new ApiError({ status: 404, code: 'NO_ENCONTRADO', message: 'No disponible' }))
    abrir('/evaluacion')
    expect(await screen.findByText(/la evaluación no está disponible/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /iniciar evaluación/i })).not.toBeInTheDocument()
  })

  it('antes de la fecha no deja iniciar', async () => {
    evaluacionApi.estado.mockResolvedValue({ estado: 'SIN_INICIAR', habilitada: false, numPreguntas: 2, duracionMinutos: 30, inicio: null })
    abrir('/evaluacion')
    expect(await screen.findByText(/aún no está habilitada/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /iniciar evaluación/i })).not.toBeInTheDocument()
  })

  it('muestra las preguntas una por una, con reloj, y califica al finalizar', async () => {
    evaluacionApi.estado.mockResolvedValue({ estado: 'SIN_INICIAR', habilitada: true, numPreguntas: 2, duracionMinutos: 30 })
    evaluacionApi.iniciar.mockResolvedValue(enCurso())
    evaluacionApi.responder.mockResolvedValue(enCurso({ respondidas: 1, pregunta: pregunta(2) }))
    evaluacionApi.finalizar.mockResolvedValue(finalizada)
    const user = userEvent.setup()
    abrir('/evaluacion')

    await user.click(await screen.findByRole('button', { name: /iniciar evaluación/i }))
    expect(await screen.findByText('Pregunta número 1')).toBeInTheDocument()
    expect(screen.queryByText('Pregunta número 2')).not.toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('10:00')

    const guardar = screen.getByRole('button', { name: /guardar y continuar/i })
    expect(guardar).toBeDisabled()
    await user.click(screen.getByLabelText('Dos'))
    await user.click(guardar)
    expect(evaluacionApi.responder).toHaveBeenCalledWith({ orden: 1, opcion: 1 })
    expect(await screen.findByText('Pregunta número 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /finalizar y calificar/i }))
    await user.click(await screen.findByRole('button', { name: /sí, finalizar/i }))
    expect(await screen.findByText(/evaluación finalizada/i)).toBeInTheDocument()
    expect(screen.getByText(/1 de 2 respuestas correctas/i)).toBeInTheDocument()
  })

  it('en 00:00 cierra sola y envía lo guardado', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    evaluacionApi.estado.mockResolvedValue(enCurso({ segundosRestantes: 2 }))
    evaluacionApi.finalizar.mockResolvedValue({ ...finalizada, forzado: true })
    abrir('/evaluacion')
    await screen.findByText('Pregunta número 1')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(evaluacionApi.finalizar).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/se cerró al terminar el tiempo/i)).toBeInTheDocument()
  })

  it('bloquea copiar y pegar durante el examen', async () => {
    evaluacionApi.estado.mockResolvedValue(enCurso())
    abrir('/evaluacion')
    await screen.findByText('Pregunta número 1')
    for (const tipo of ['copy', 'paste', 'cut', 'contextmenu']) {
      const evento = new Event(tipo, { bubbles: true, cancelable: true })
      document.body.dispatchEvent(evento)
      expect(evento.defaultPrevented).toBe(true)
    }
  })
})

describe('avance del concurso', () => {
  const concurso = (cambios = {}) => ({
    formularioAbierto: true,
    fases: [{ codigo: 'MERITOS', nombre: 'Fase de méritos', publicada: true }],
    estadoConcurso: 'POSTULADO',
    evaluacion: false,
    puedeReconsiderar: false,
    reconsideraciones: [],
    ...cambios,
  })

  it('la evaluación queda oculta hasta superar los méritos', async () => {
    postulacionApi.concurso.mockResolvedValue(concurso())
    abrir('/concurso')
    expect(await screen.findByText('Fase de méritos')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /ir a la evaluación/i })).not.toBeInTheDocument()
  })

  it('con méritos superados muestra el enlace y sus notas', async () => {
    postulacionApi.concurso.mockResolvedValue(concurso({ estadoConcurso: 'EVALUACION_TECNICA', evaluacion: true, puntajeMeritos: 80 }))
    abrir('/concurso')
    expect(await screen.findByRole('link', { name: /ir a la evaluación/i })).toHaveAttribute('href', '/evaluacion')
    expect(screen.getByText('80')).toBeInTheDocument()
  })

  it('permite solicitar una reconsideración solo en su fase', async () => {
    postulacionApi.concurso.mockResolvedValue(concurso({ puedeReconsiderar: true }))
    postulacionApi.reconsiderar.mockResolvedValue(
      concurso({ reconsideraciones: [{ id: 1, etapa: 'MERITOS', estado: 'PENDIENTE', motivo: 'Revisar mi título', responderAntes: '2026-12-01T10:00:00Z' }] }),
    )
    const user = userEvent.setup()
    abrir('/concurso')
    await user.selectOptions(await screen.findByLabelText(/^etapa/i), 'MERITOS')
    await user.type(screen.getByLabelText(/^motivo/i), 'Revisar mi título')
    await user.click(screen.getByRole('button', { name: /solicitar reconsideración/i }))
    expect(postulacionApi.reconsiderar).toHaveBeenCalledWith({ etapa: 'MERITOS', motivo: 'Revisar mi título' })
    expect(await screen.findByText(/plazo de respuesta/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /solicitar reconsideración/i })).not.toBeInTheDocument()
  })
})
