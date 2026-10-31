import { api } from './client'

export const verificarIdentidad = (datos) =>
  api.post('/auth/verificar-identidad', datos).then((r) => r.data)

export const registrar = (datos) => api.post('/auth/registro', datos).then((r) => r.data)

export const login = (cedula, password) =>
  api.post('/auth/login', { cedula, password }).then((r) => r.data)

export const me = () => api.get('/auth/me').then((r) => r.data)

export const recuperar = (datos) => api.post('/auth/recuperar', datos).then((r) => r.data)

export const restablecer = (token, nuevaPassword) =>
  api.post('/auth/restablecer', { token, nuevaPassword }).then((r) => r.data)
