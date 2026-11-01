import { z } from 'zod'
import { errorCedula } from '../../utils/cedula'

// Cédula con el motivo exacto del error (longitud, provincia, dígito verificador).
export const cedula = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    const error = errorCedula(v)
    if (error) ctx.addIssue({ code: 'custom', message: error })
  })

// Reglas de la contraseña (las mismas que valida el backend). bcrypt admite hasta 72 bytes.
export const REGLAS_PASSWORD = [
  { texto: 'Entre 8 y 72 caracteres', cumple: (p) => p.length >= 8 && new TextEncoder().encode(p).length <= 72 },
  { texto: 'Al menos una letra', cumple: (p) => /\p{L}/u.test(p) },
  { texto: 'Al menos un número', cumple: (p) => /\d/.test(p) },
]

export const password = z.string().superRefine((p, ctx) => {
  const falla = REGLAS_PASSWORD.find((r) => !r.cumple(p))
  if (falla) ctx.addIssue({ code: 'custom', message: `La contraseña debe tener: ${falla.texto.toLowerCase()}` })
})

export const RE_DACTILAR = /^[A-Z]\d{4}[A-Z]\d{4}$/
const FECHA_MINIMA = '1950-01-01'
const hoy = () => new Date().toISOString().slice(0, 10)

// Validación de identidad: cédula + fecha de expedición o código dactilar (EF-11).
export const identidadSchema = z
  .object({
    cedula,
    metodo: z.enum(['fecha', 'dactilar']),
    fechaExpedicion: z.string().optional(),
    codigoDactilar: z.string().trim().toUpperCase().optional(),
  })
  .superRefine((v, ctx) => {
    const error = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.metodo === 'fecha') {
      if (!v.fechaExpedicion) error('fechaExpedicion', 'Ingrese la fecha de expedición')
      else if (v.fechaExpedicion > hoy()) error('fechaExpedicion', 'La fecha no puede ser futura')
      else if (v.fechaExpedicion < FECHA_MINIMA) error('fechaExpedicion', 'Revise el año de la fecha de expedición')
    } else if (!v.codigoDactilar) {
      error('codigoDactilar', 'Ingrese el código dactilar')
    } else if (!RE_DACTILAR.test(v.codigoDactilar)) {
      error('codigoDactilar', 'Formato: letra, 4 dígitos, letra y 4 dígitos (ej. V4443V4442)')
    }
  })

// Solo se envía el dato del método elegido.
export const identidadPayload = (v) => ({
  cedula: v.cedula,
  ...(v.metodo === 'fecha' ? { fechaExpedicion: v.fechaExpedicion } : { codigoDactilar: v.codigoDactilar }),
})

const conConfirmacion = (campo) => (v, ctx) => {
  if (v.confirmar && v[campo] !== v.confirmar) {
    ctx.addIssue({ code: 'custom', path: ['confirmar'], message: 'Las contraseñas no coinciden' })
  }
}

const confirmar = z.string().min(1, 'Confirme la contraseña')

export const cuentaSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Ingrese su correo electrónico')
      .max(150, 'Máximo 150 caracteres')
      .pipe(z.email('Correo electrónico inválido (ej. nombre@correo.com)')),
    password,
    confirmar,
  })
  .superRefine(conConfirmacion('password'))

export const loginSchema = z.object({
  cedula,
  password: z.string().min(1, 'Ingrese su contraseña'),
})

export const restablecerSchema = z
  .object({ nuevaPassword: password, confirmar })
  .superRefine(conConfirmacion('nuevaPassword'))
