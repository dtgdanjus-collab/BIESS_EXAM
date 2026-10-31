import axios from 'axios'
import { useAuthStore } from '../store/authStore'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Error uniforme para toda la app: mismo formato que el backend { code, message, details }.
export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details ?? {}
  }
}

// Agrega el JWT a cada petición si hay sesión.
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Normaliza errores y cierra la sesión si el backend rechaza el token.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject(
        new ApiError({
          status: 0,
          code: 'RED',
          message: 'No se pudo conectar con el servidor. Verifique su conexión e inténtelo nuevamente.',
        }),
      )
    }

    const { status, data } = error.response
    const body = data?.error ?? {}
    const sentToken = Boolean(error.config?.headers?.Authorization)

    if (status === 401 && sentToken) {
      useAuthStore.getState().logout()
      if (window.location.pathname !== '/login') {
        window.location.assign('/login?expirada=1')
      }
    }

    return Promise.reject(
      new ApiError({
        status,
        code: body.code ?? 'INTERNO',
        message: body.message ?? 'Ocurrió un error inesperado',
        details: body.details,
      }),
    )
  },
)
