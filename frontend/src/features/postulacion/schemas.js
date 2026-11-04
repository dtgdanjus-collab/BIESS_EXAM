import { z } from 'zod'
import { cedulaValida } from '../../utils/cedula'
import { hoyIso } from '../../utils/fechas'

const texto = (max, msg = 'Es obligatorio') =>
  z.string().trim().min(1, msg).max(max, `Máximo ${max} caracteres`)
const textoOpcional = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`)
const seleccion = (msg = 'Seleccione una opción') => z.string().min(1, msg)
const telefono = z.string().trim().regex(/^\+?\d{7,15}$/, 'Teléfono inválido (7 a 15 dígitos)')
// Opción de una lista fija. No se usa z.enum porque su fallo aborta las validaciones
// cruzadas del objeto (p. ej. fecha fin ≥ inicio) y el usuario no vería esos errores.
const opcion = (valores, msg) => z.string().refine((v) => valores.includes(v), msg)
const siNo = z.boolean().nullable().refine((v) => v !== null, 'Seleccione Sí o No')

// Documentos de respaldo: id del PDF ya subido. Los que llevan asterisco en el requerimiento son obligatorios.
const documentoOpcional = z.number().nullish()
const documentoObligatorio = z.number().nullish().refine((v) => v != null, 'Adjunte el documento de respaldo')

export const fecha = (msg = 'Es obligatoria') =>
  z.string().min(1, msg).refine((v) => v <= hoyIso(), 'No puede ser una fecha futura')

export const CON_CONYUGE = ['CASADO/A', 'UNION DE HECHO']

const haceAnios = (n) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  return hoyIso(d)
}

// 1.1 — mismas reglas que el backend (validarDatos).
export const datosPersonalesSchema = z
  .object({
    nombres: texto(100),
    apellidos: texto(100),
    genero: opcion(['MASCULINO', 'FEMENINO'], 'Seleccione una opción'),
    fechaNacimiento: fecha()
      .refine((v) => v >= '1900-01-01', 'La fecha de nacimiento no es válida')
      .refine((v) => v > hoyIso() || v <= haceAnios(18), 'Debe ser mayor de edad'),
    estadoCivil: opcion(['SOLTERO/A', 'CASADO/A', 'DIVORCIADO/A', 'VIUDO/A', 'UNION DE HECHO'], 'Seleccione una opción'),
    conyugeNombres: textoOpcional(200),
    conyugeCedula: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!CON_CONYUGE.includes(v.estadoCivil)) return
    if (!v.conyugeNombres) ctx.addIssue({ code: 'custom', path: ['conyugeNombres'], message: 'Es obligatorio' })
    if (!cedulaValida(v.conyugeCedula)) ctx.addIssue({ code: 'custom', path: ['conyugeCedula'], message: 'Cédula inválida' })
  })

// 1.2 — la cascada depende de si el país elegido es Ecuador.
export const contactoSchema = (ecuadorId) =>
  z
    .object({
      paisId: seleccion('Seleccione el país'),
      provinciaId: z.string(),
      cantonId: z.string(),
      provinciaTexto: textoOpcional(80),
      ciudadTexto: textoOpcional(80),
      telefonoCelular: telefono,
      telefonoDomicilio: z.union([z.literal(''), telefono]),
      correo1: z.string().trim().pipe(z.email('Correo electrónico inválido')),
      correo2: z.union([z.literal(''), z.string().trim().pipe(z.email('Correo electrónico inválido'))]),
      callePrincipal: texto(150, 'Es obligatoria'),
      numero: textoOpcional(20),
      calleSecundaria: textoOpcional(150),
      sector: textoOpcional(100),
      referencia: textoOpcional(250),
    })
    .superRefine((v, ctx) => {
      const req = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (v.paisId === String(ecuadorId)) {
        if (!v.provinciaId) req('provinciaId', 'Seleccione la provincia')
        if (!v.cantonId) req('cantonId', 'Seleccione el cantón')
      } else if (v.paisId) {
        if (!v.provinciaTexto) req('provinciaTexto', 'Es obligatoria')
        if (!v.ciudadTexto) req('ciudadTexto', 'Es obligatoria')
      }
    })

// 1.3
export const familiaresSchema = z
  .object({
    tieneFamiliares: siNo,
    items: z.array(
      z.object({
        nombresApellidos: texto(200),
        parentescoId: seleccion(),
        institucion: opcion(['IESS', 'BIESS'], 'Seleccione IESS o BIESS'),
        area: texto(150),
        cargo: texto(150),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.tieneFamiliares && v.items.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Agregue al menos un familiar o seleccione "No"' })
    }
  })

const rangoFechas = (v, ctx) => {
  if (v.fechaInicio && v.fechaFin && v.fechaFin < v.fechaInicio) {
    ctx.addIssue({ code: 'custom', path: ['fechaFin'], message: 'Debe ser posterior o igual a la fecha de inicio' })
  }
}

const alMenosUno = (msg) => (items, ctx) => {
  if (items.length === 0) ctx.addIssue({ code: 'custom', message: msg })
}

// 1.5
export const formacionSchema = z.object({
  items: z
    .array(
      z.object({
        nivelId: seleccion(),
        institucion: texto(200),
        tipo: opcion(['NACIONAL', 'EXTRANJERA'], 'Seleccione el tipo de institución'),
        titulo: texto(200),
        areaId: seleccion(),
        registroSenescyt: texto(40),
        fechaRegistro: fecha(),
        documentoId: documentoOpcional,
      }),
    )
    .superRefine(alMenosUno('Agregue al menos un título')),
})

// 1.6
export const experienciaSchema = z.object({
  items: z
    .array(
      z
        .object({
          tipo: opcion(['GENERAL', 'DIRECCION'], 'Seleccione el tipo de experiencia'),
          cargo: texto(150),
          institucion: texto(200),
          fechaInicio: fecha(),
          fechaFin: fecha(),
          areaId: seleccion(),
          descripcion: texto(1000),
          documentoId: documentoObligatorio,
        })
        .superRefine(rangoFechas),
    )
    .superRefine(alMenosUno('Agregue al menos una experiencia')),
})

// 1.7
export const publicacionesSchema = z
  .object({
    tienePublicaciones: siNo,
    items: z.array(
      z.object({
        titulo: texto(300),
        tipo: opcion(['PUBLICACION', 'INVESTIGACION'], 'Seleccione el tipo'),
        medio: texto(200),
        fecha: fecha(),
        relacionada: siNo,
        documentoId: documentoObligatorio,
      }),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.tienePublicaciones && v.items.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Agregue al menos una publicación o seleccione "No"' })
    }
  })

// 1.8 (opcional: puede guardarse vacía)
export const capacitacionesSchema = z.object({
  items: z.array(
    z
      .object({
        tipo: opcion(['CURSO', 'SEMINARIO', 'TALLER'], 'Seleccione el tipo'),
        nombre: texto(200),
        institucion: texto(200),
        fechaInicio: fecha(),
        fechaFin: fecha(),
        horas: z.coerce.number({ message: 'Ingrese las horas' }).int('Debe ser un número entero').min(1, 'Debe ser mayor a 0'),
        documentoId: documentoOpcional,
      })
      .superRefine(rangoFechas),
  ),
})

// 1.9 — se arma con el catálogo de preguntas: todas obligatorias y la 1.9.7 con detalle.
export const inhabilidadesSchema = (preguntas) =>
  z.object({
    respuestas: z.array(
      z
        .object({
          preguntaId: z.number(),
          respuesta: siNo,
          detalle: z.object({
            institucion: z.string().trim(),
            cargo: z.string().trim(),
            fechaFin: z.string(),
            motivo: z.string().trim(),
          }),
        })
        .superRefine((r, ctx) => {
          const q = preguntas.find((p) => p.id === r.preguntaId)
          if (!q?.requiereDetalle || r.respuesta === null || r.respuesta === q.respuestaEsperada) return
          const req = (campo, max, msg = 'Es obligatorio') => {
            const val = r.detalle[campo]
            if (!val) ctx.addIssue({ code: 'custom', path: ['detalle', campo], message: msg })
            else if (max && val.length > max) ctx.addIssue({ code: 'custom', path: ['detalle', campo], message: `Máximo ${max} caracteres` })
          }
          req('institucion', 200)
          req('motivo', 500)
          if (r.detalle.cargo.length > 150) ctx.addIssue({ code: 'custom', path: ['detalle', 'cargo'], message: 'Máximo 150 caracteres' })
          if (r.detalle.fechaFin && r.detalle.fechaFin > hoyIso()) {
            ctx.addIssue({ code: 'custom', path: ['detalle', 'fechaFin'], message: 'No puede ser una fecha futura' })
          }
        }),
    ),
  })

// 1.4
export const cargoSchema = z
  .object({
    sector: seleccion('Seleccione el cargo al que postula'),
    tieneRespaldo: siNo,
    organizacionNombre: textoOpcional(200),
    organizacionDocumentoId: z.number().nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.tieneRespaldo && !v.organizacionNombre) {
      ctx.addIssue({ code: 'custom', path: ['organizacionNombre'], message: 'Indique el nombre de la organización' })
    }
    if (v.tieneRespaldo && v.organizacionDocumentoId == null) {
      ctx.addIssue({ code: 'custom', path: ['organizacionDocumentoId'], message: 'Adjunte el documento de respaldo' })
    }
  })
