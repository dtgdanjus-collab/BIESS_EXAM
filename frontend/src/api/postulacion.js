import { api } from './client'

const data = (r) => r.data

export const postulacionApi = {
  obtener: () => api.get('/postulacion').then(data),
  crear: () => api.post('/postulacion').then(data),
  datosPersonales: (body) => api.put('/postulacion/datos-personales', body).then(data),
  contacto: (body) => api.put('/postulacion/contacto', body).then(data),
  familiares: (body) => api.put('/postulacion/familiares', body).then(data),
  cargo: (body) => api.post('/postulacion/cargo', body).then(data),
  formacion: (items) => api.put('/postulacion/formacion', { items }).then(data),
  experiencia: (items) => api.put('/postulacion/experiencia', { items }).then(data),
  publicaciones: (body) => api.put('/postulacion/publicaciones', body).then(data),
  capacitaciones: (items) => api.put('/postulacion/capacitaciones', { items }).then(data),
  inhabilidades: (respuestas) => api.put('/postulacion/inhabilidades', { respuestas }).then(data),
  enviar: () => api.post('/postulacion/enviar', { aceptaConsentimiento: true }).then(data),
}
