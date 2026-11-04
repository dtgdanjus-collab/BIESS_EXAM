import { api } from './client'

const data = (r) => r.data

export const postulacionApi = {
  obtener: () => api.get('/postulacion').then(data),
  crear: () => api.post('/postulacion').then(data),
  datosPersonales: (body) => api.put('/postulacion/datos-personales', body).then(data),
  contacto: (body) => api.put('/postulacion/contacto', body).then(data),
  eliminarContacto: () => api.delete('/postulacion/contacto').then(data),
  eliminarInhabilidades: () => api.delete('/postulacion/inhabilidades').then(data),
  familiares: (body) => api.put('/postulacion/familiares', body).then(data),
  cargo: (body) => api.post('/postulacion/cargo', body).then(data),
  validarCargo: (sector) => api.post('/postulacion/cargo/validar', { sector }).then(data),
  eliminarCargo: () => api.delete('/postulacion/cargo').then(data),
  // Más tiempo que el resto: un PDF por datos móviles tarda.
  subirDocumento: (categoria, archivo) => {
    const cuerpo = new FormData()
    cuerpo.append('categoria', categoria)
    cuerpo.append('archivo', archivo)
    return api
      .post('/postulacion/documentos', cuerpo, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
      .then(data)
  },
  descargarDocumento: (id) => api.get(`/postulacion/documentos/${id}`, { responseType: 'blob', timeout: 120000 }).then(data),
  formacion: (items) => api.put('/postulacion/formacion', { items }).then(data),
  experiencia: (items) => api.put('/postulacion/experiencia', { items }).then(data),
  publicaciones: (body) => api.put('/postulacion/publicaciones', body).then(data),
  capacitaciones: (items) => api.put('/postulacion/capacitaciones', { items }).then(data),
  inhabilidades: (respuestas) => api.put('/postulacion/inhabilidades', { respuestas }).then(data),
  enviar: () => api.post('/postulacion/enviar', { aceptaConsentimiento: true }).then(data),
  guardarPostulacion: () => api.post('/postulacion/guardar').then(data),
  formulario: () => api.get('/postulacion/formulario').then(data),
  concurso: () => api.get('/postulacion/concurso').then(data),
  concursoPublico: () => api.get('/concurso').then(data),
  reconsiderar: (body) => api.post('/postulacion/reconsideraciones', body).then(data),
}

// EF-14: el backend responde 404 a quien no superó la fase de méritos.
export const evaluacionApi = {
  estado: () => api.get('/evaluacion').then(data),
  iniciar: () => api.post('/evaluacion/iniciar').then(data),
  responder: (body) => api.post('/evaluacion/responder', body).then(data),
  finalizar: () => api.post('/evaluacion/finalizar').then(data),
  reporte: () => api.get('/evaluacion/reporte.pdf', { responseType: 'blob', timeout: 60000 }).then(data),
}
