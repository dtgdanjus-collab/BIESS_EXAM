import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'
import { AppRouter } from '../../routes/AppRouter'
import { useAuthStore } from '../../store/authStore'

vi.mock('../../api/auth')

const abrir = (ruta) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <AppRouter />
    </MemoryRouter>,
  )

const llenarLogin = async (user, password = 'Mala12345') => {
  await user.type(screen.getByLabelText(/número de cédula/i), '0106789019')
  await user.type(screen.getByLabelText(/^contraseña/i), password)
  await user.click(screen.getByRole('button', { name: /ingresar/i }))
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.getState().logout()
  })

  it('muestra el mensaje literal y los intentos restantes ante un 401', async () => {
    authApi.login.mockRejectedValue(
      new ApiError({
        status: 401,
        code: 'CREDENCIALES',
        message: 'Sus credenciales de ingreso son incorrectas',
        details: { intentosRestantes: 2 },
      }),
    )
    const user = userEvent.setup()
    abrir('/login')
    await llenarLogin(user)
    expect(await screen.findByText('Sus credenciales de ingreso son incorrectas')).toBeInTheDocument()
    expect(screen.getByText(/le quedan 2 intentos/i)).toBeInTheDocument()
  })

  it('ante un 423 muestra la cuenta regresiva y deshabilita el formulario', async () => {
    authApi.login.mockRejectedValue(
      new ApiError({
        status: 423,
        code: 'BLOQUEADO',
        message: 'Cuenta bloqueada temporalmente',
        details: { segundosRestantes: 600 },
      }),
    )
    const user = userEvent.setup()
    abrir('/login')
    await llenarLogin(user)
    expect(await screen.findByRole('button', { name: /bloqueado \(10:00\)/i })).toBeDisabled()
    expect(screen.getByLabelText(/número de cédula/i)).toBeDisabled()
  })

  it('valida la cédula en el navegador antes de llamar a la API', async () => {
    const user = userEvent.setup()
    abrir('/login')
    await user.type(screen.getByLabelText(/número de cédula/i), '0102345674')
    await user.type(screen.getByLabelText(/^contraseña/i), 'x')
    await user.click(screen.getByRole('button', { name: /ingresar/i }))
    expect(await screen.findByText(/dígito verificador no coincide/i)).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('con credenciales correctas guarda la sesión y entra al formulario', async () => {
    authApi.login.mockResolvedValue({
      token: 'jwt',
      expiraEn: new Date(Date.now() + 3_600_000).toISOString(),
      usuario: { id: 6, cedula: '0106789019', nombres: 'Diana Patricia', apellidos: 'Quezada León' },
    })
    const user = userEvent.setup()
    abrir('/login')
    await llenarLogin(user, 'Biess2026')
    expect(await screen.findByText(/Diana Patricia Quezada León/)).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBe('jwt')
  })
})

describe('RegistroPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.getState().logout()
  })

  it('valida identidad, crea la cuenta y vuelve al login con aviso', async () => {
    authApi.verificarIdentidad.mockResolvedValue({ registroToken: 'tok-1' })
    authApi.registrar.mockResolvedValue({ id: 9 })
    const user = userEvent.setup()
    abrir('/registro')

    await user.type(screen.getByLabelText(/número de cédula/i), '0102345675')
    await user.click(screen.getByRole('radio', { name: /código dactilar/i }))
    await user.type(screen.getByLabelText(/código dactilar/i), 'v4443v4442')
    await user.click(screen.getByRole('button', { name: /validar identidad/i }))
    expect(authApi.verificarIdentidad).toHaveBeenCalledWith({ cedula: '0102345675', codigoDactilar: 'V4443V4442' })

    await user.type(await screen.findByLabelText(/correo electrónico/i), 'maria@correo.com')
    await user.type(screen.getByLabelText(/^contraseña/i), 'Biess2026')
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'Biess2026')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(authApi.registrar).toHaveBeenCalledWith({ registroToken: 'tok-1', email: 'maria@correo.com', password: 'Biess2026' })
    expect(await screen.findByText(/cuenta creada correctamente/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/número de cédula/i)).toHaveValue('0102345675')
  })

  it('muestra "La información ingresada es incorrecta" con los intentos restantes', async () => {
    authApi.verificarIdentidad.mockRejectedValue(
      new ApiError({
        status: 401,
        code: 'IDENTIDAD',
        message: 'La información ingresada es incorrecta',
        details: { intentosRestantes: 1 },
      }),
    )
    const user = userEvent.setup()
    abrir('/registro')
    await user.type(screen.getByLabelText(/número de cédula/i), '0106789019')
    await user.type(screen.getByLabelText(/fecha de expedición de la cédula/i), '2020-01-01')
    await user.click(screen.getByRole('button', { name: /validar identidad/i }))
    expect(await screen.findByText('La información ingresada es incorrecta')).toBeInTheDocument()
    expect(screen.getByText(/le queda 1 intento/i)).toBeInTheDocument()
  })
})

describe('validaciones del registro', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.getState().logout()
  })

  it('la cédula solo admite dígitos y muestra ✔ cuando es válida', async () => {
    const user = userEvent.setup()
    abrir('/registro')
    const cedula = screen.getByLabelText(/número de cédula/i)
    await user.type(cedula, '01a02-3456 75')
    expect(cedula).toHaveValue('0102345675')
    expect(screen.getByText('Cédula válida')).toBeInTheDocument()
  })

  it('"Usar" llena el formulario con una persona de prueba', async () => {
    authApi.verificarIdentidad.mockResolvedValue({ registroToken: 'tok' })
    const user = userEvent.setup()
    abrir('/registro')
    await user.click(screen.getByText(/personas de prueba/i))
    await user.click(screen.getByRole('button', { name: /usar la persona de prueba 0103456786/i }))
    expect(screen.getByLabelText(/número de cédula/i)).toHaveValue('0103456786')
    await user.click(screen.getByRole('button', { name: /validar identidad/i }))
    expect(authApi.verificarIdentidad).toHaveBeenCalledWith({ cedula: '0103456786', fechaExpedicion: '2018-02-14' })
  })

  it('marca los requisitos de la contraseña y rechaza más de 72 bytes', async () => {
    authApi.verificarIdentidad.mockResolvedValue({ registroToken: 'tok' })
    const user = userEvent.setup()
    abrir('/registro')
    await user.type(screen.getByLabelText(/número de cédula/i), '0102345675')
    await user.type(screen.getByLabelText(/fecha de expedición de la cédula/i), '2019-06-20')
    await user.click(screen.getByRole('button', { name: /validar identidad/i }))

    const pass = await screen.findByLabelText(/^contraseña/i)
    await user.type(pass, 'abc1')
    const reglas = screen.getByRole('list', { name: /requisitos de la contraseña/i })
    expect(within(reglas).getByText('Al menos un número').className).toMatch(/emerald/)
    expect(within(reglas).getByText('Entre 8 y 72 caracteres').className).not.toMatch(/emerald/)

    await user.clear(pass)
    await user.type(screen.getByLabelText(/correo electrónico/i), 'maria@correo.com')
    fireEvent.change(pass, { target: { value: 'a1'.repeat(37) } }) // 74 bytes (maxLength lo impide al teclear)
    await user.type(screen.getByLabelText(/confirmar contraseña/i), 'x')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))
    expect(await screen.findByText(/entre 8 y 72 caracteres/i, { selector: 'p' })).toBeInTheDocument()
    expect(authApi.registrar).not.toHaveBeenCalled()
  })
})

describe('teclado en el método de validación', () => {
  it('las flechas cambian la opción y solo la activa recibe el tabulador', async () => {
    useAuthStore.getState().logout()
    const user = userEvent.setup()
    abrir('/registro')
    const fecha = screen.getByRole('radio', { name: /fecha de expedición/i })
    const codigo = screen.getByRole('radio', { name: /código dactilar/i })
    expect(screen.getByRole('radiogroup', { name: /validar con/i })).toBeInTheDocument()
    expect(fecha).toHaveAttribute('tabindex', '0')
    expect(codigo).toHaveAttribute('tabindex', '-1')

    fecha.focus()
    await user.keyboard('{ArrowRight}')
    expect(codigo).toBeChecked()
    expect(codigo).toHaveFocus()
    expect(screen.getByLabelText(/código dactilar/i)).toBeInTheDocument()
  })
})

describe('género de una cédula nueva', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.getState().logout()
  })

  it('lo pide solo si el backend lo requiere y lo envía al reintentar', async () => {
    authApi.verificarIdentidad
      .mockRejectedValueOnce(
        new ApiError({
          status: 400,
          code: 'VALIDACION',
          message: 'Indique su género',
          details: { requiereGenero: true, campos: { genero: 'Seleccione una opción' } },
        }),
      )
      .mockResolvedValueOnce({ registroToken: 'tok' })
    const user = userEvent.setup()
    abrir('/registro')
    expect(screen.queryByLabelText(/^género/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/número de cédula/i), '0101010106')
    await user.type(screen.getByLabelText(/fecha de expedición de la cédula/i), '2024-07-29')
    await user.click(screen.getByRole('button', { name: /validar identidad/i }))

    const genero = await screen.findByLabelText(/^género/i)
    await user.click(screen.getByRole('button', { name: /validar identidad/i }))
    expect(await screen.findByText('Seleccione una opción')).toBeInTheDocument()
    expect(authApi.verificarIdentidad).toHaveBeenCalledTimes(1)

    await user.selectOptions(genero, 'FEMENINO')
    await user.click(screen.getByRole('button', { name: /validar identidad/i }))
    expect(authApi.verificarIdentidad).toHaveBeenLastCalledWith({
      cedula: '0101010106',
      fechaExpedicion: '2024-07-29',
      genero: 'FEMENINO',
    })
    expect(await screen.findByLabelText(/correo electrónico/i)).toBeInTheDocument()
  })
})
