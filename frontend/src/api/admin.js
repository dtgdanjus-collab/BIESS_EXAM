import axios from 'axios'
import { useAdminStore } from '../store/adminStore'
import { ApiError } from './client'

// Cliente propio: la sesión del módulo de administración es independiente de la del postulante.
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'}/admin`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const { token } = useAdminStore.getState()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject(new ApiError({ status: 0, code: 'RED', message: 'No se pudo conectar con el servidor.' }))
    }
    const { status, data } = error.response
    const body = data?.error ?? {}
    if (status === 401 && error.config?.headers?.Authorization) useAdminStore.getState().logout()
    return Promise.reject(
      new ApiError({ status, code: body.code ?? 'INTERNO', message: body.message ?? 'Ocurrió un error inesperado', details: body.details }),
    )
  },
)

const data = (r) => r.data
const blob = (ruta, params) => api.get(ruta, { params, responseType: 'blob', timeout: 120000 }).then(data)

export const adminApi = {
  login: (body) => api.post('/login', body).then(data),
  dashboard: () => api.get('/dashboard').then(data),
  postulantes: (params) => api.get('/postulantes', { params }).then(data),
  detalle: (id) => api.get(`/postulantes/${id}`).then(data),
  documento: (id, doc) => blob(`/postulantes/${id}/documentos/${doc}`),
  reporteEvaluacion: (id) => blob(`/postulantes/${id}/evaluacion.pdf`),
  calificar: (id, body) => api.put(`/postulantes/${id}/calificacion`, body).then(data),
  matrizXlsx: (params) => blob('/matriz.xlsx', params),
  matrizPdf: (params) => blob('/matriz.pdf', params),
  concurso: () => api.get('/concurso').then(data),
  guardarConfig: (body) => api.put('/concurso', body).then(data),
  guardarFase: (codigo, body) => api.put(`/fases/${codigo}`, body).then(data),
  preguntas: () => api.get('/evaluacion/preguntas').then(data),
  crearPregunta: (body) => api.post('/evaluacion/preguntas', body).then(data),
  importarPreguntas: (items) => api.post('/evaluacion/preguntas/importar', { items }).then(data),
  guardarPregunta: (id, body) => api.put(`/evaluacion/preguntas/${id}`, body).then(data),
  eliminarPregunta: (id) => api.delete(`/evaluacion/preguntas/${id}`).then(data),
  evaluacionConfig: () => api.get('/evaluacion/config').then(data),
  guardarEvaluacionConfig: (body) => api.put('/evaluacion/config', body).then(data),
  resultados: () => api.get('/evaluacion/resultados').then(data),
  reconsideraciones: () => api.get('/reconsideraciones').then(data),
  responderReconsideracion: (id, body) => api.put(`/reconsideraciones/${id}`, body).then(data),
  informarReconsideracion: (id, body) => api.put(`/reconsideraciones/${id}/informe`, body).then(data),
  guardarTablaMeritos: (body) => api.put('/meritos/tabla', body).then(data),
  recalcularMeritos: () => api.post('/meritos/recalcular').then(data),
  elegibles: () => api.get('/elegibles').then(data),
  elegiblesXlsx: () => blob('/elegibles.xlsx'),
  elegiblesPdf: () => blob('/elegibles.pdf'),
  bitacora: (params) => api.get('/bitacora', { params }).then(data),
  usuarios: () => api.get('/usuarios').then(data),
  crearUsuario: (body) => api.post('/usuarios', body).then(data),
  cambiarActivo: (id, activo) => api.put(`/usuarios/${id}/activo`, { activo }).then(data),
}
