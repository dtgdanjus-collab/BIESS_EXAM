import { z } from 'zod'

const texto = (max, msg = 'Es obligatorio') =>
  z.string().trim().min(1, msg).max(max, `Máximo ${max} caracteres`)
const textoOpcional = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`)
const seleccion = (msg = 'Seleccione una opción') => z.string().min(1, msg)
const telefono = z.string().trim().regex(/^\+?\d{7,15}$/, 'Teléfono inválido (7 a 15 dígitos)')
const siNo = z.boolean().nullable().refine((v) => v !== null, 'Seleccione Sí o No')

const hoy = () => new Date().toISOString().slice(0, 10)
export const fecha = (msg = 'Es obligatoria') =>
  z.string().min(1, msg).refine((v) => v <= hoy(), 'No puede ser una fecha futura')

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
        institucion: z.enum(['IESS', 'BIESS'], { message: 'Seleccione IESS o BIESS' }),
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

// 1.4
export const cargoSchema = z
  .object({
    sector: seleccion('Seleccione el cargo al que postula'),
    tieneRespaldo: siNo,
    organizacionNombre: textoOpcional(200),
  })
  .superRefine((v, ctx) => {
    if (v.tieneRespaldo && !v.organizacionNombre) {
      ctx.addIssue({ code: 'custom', path: ['organizacionNombre'], message: 'Indique el nombre de la organización' })
    }
  })
