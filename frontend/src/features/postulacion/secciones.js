// Secciones del formulario (numerales del requerimiento) y cuándo se consideran completas.
export const SECCIONES = [
  { id: 'personal', titulo: 'Información personal', numeral: '1.1', completa: (p) => Boolean(p.datosPersonales) },
  { id: 'contacto', titulo: 'Domicilio y contacto', numeral: '1.2', completa: (p) => Boolean(p.contacto) },
  { id: 'familiares', titulo: 'Familiares en IESS/BIESS', numeral: '1.3', completa: (p) => p.tieneFamiliares !== null },
  { id: 'cargo', titulo: 'Selección del cargo', numeral: '1.4', completa: (p) => Boolean(p.sectorCodigo) },
  { id: 'formacion', titulo: 'Formación académica', numeral: '1.5', completa: (p) => p.formacion.length > 0 },
  { id: 'experiencia', titulo: 'Experiencia profesional', numeral: '1.6', completa: (p) => p.experiencia.length > 0 },
  { id: 'publicaciones', titulo: 'Publicaciones', numeral: '1.7', completa: (p) => p.tienePublicaciones !== null },
  { id: 'capacitacion', titulo: 'Capacitación', numeral: '1.8', completa: (p) => p.capacitaciones.length > 0 },
  { id: 'inhabilidades', titulo: 'Inhabilidades', numeral: '1.9', completa: (p) => p.inhabilidades.length > 0 },
  { id: 'envio', titulo: 'Consentimiento y envío', numeral: '1.10', completa: (p) => p.estado === 'ENVIADA' },
]

export const siguienteSeccion = (id) => {
  const i = SECCIONES.findIndex((s) => s.id === id)
  return SECCIONES[i + 1] ?? null
}
