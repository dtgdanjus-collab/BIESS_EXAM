import { z } from 'zod'
import { cedulaValida } from '../../utils/cedula'

export const cedula = z
  .string()
  .trim()
  .regex(/^\d{10}$/, 'La cédula debe tener 10 dígitos')
  .refine(cedulaValida, 'Cédula inválida')

export const password = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, 'Debe incluir al menos una letra')
  .regex(/\d/, 'Debe incluir al menos un número')

// Validación de identidad: cédula + fecha de expedición o código dactilar (EF-11).
export const identidadSchema = z
  .object({
    cedula,
    metodo: z.enum(['fecha', 'dactilar']),
    fechaExpedicion: z.string().optional(),
    codigoDactilar: z.string().trim().toUpperCase().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.metodo === 'fecha') {
      if (!v.fechaExpedicion) {
        ctx.addIssue({ code: 'custom', path: ['fechaExpedicion'], message: 'Ingrese la fecha de expedición' })
      } else if (new Date(v.fechaExpedicion) > new Date()) {
        ctx.addIssue({ code: 'custom', path: ['fechaExpedicion'], message: 'La fecha no puede ser futura' })
      }
    } else if (!/^[A-Z0-9]{10}$/.test(v.codigoDactilar ?? '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['codigoDactilar'],
        message: 'El código dactilar tiene 10 caracteres alfanuméricos (ej. V4443V4442)',
      })
    }
  })

// Solo se envía el dato del método elegido.
export const identidadPayload = (v) => ({
  cedula: v.cedula,
  ...(v.metodo === 'fecha' ? { fechaExpedicion: v.fechaExpedicion } : { codigoDactilar: v.codigoDactilar }),
})

const conConfirmacion = (campo) => (v, ctx) => {
  if (v[campo] !== v.confirmar) {
    ctx.addIssue({ code: 'custom', path: ['confirmar'], message: 'Las contraseñas no coinciden' })
  }
}

export const cuentaSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email('Correo electrónico inválido')),
    password,
    confirmar: z.string(),
  })
  .superRefine(conConfirmacion('password'))

export const loginSchema = z.object({
  cedula,
  password: z.string().min(1, 'Ingrese su contraseña'),
})

export const restablecerSchema = z
  .object({ nuevaPassword: password, confirmar: z.string() })
  .superRefine(conConfirmacion('nuevaPassword'))
