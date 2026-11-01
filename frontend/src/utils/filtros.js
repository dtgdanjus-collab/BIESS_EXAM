/**
 * register() de React Hook Form con un filtro aplicado mientras se escribe.
 * El valor se corrige en el propio input antes de que el formulario lo lea,
 * así el usuario nunca ve caracteres no permitidos.
 */
export function conFiltro(registro, filtro) {
  return {
    ...registro,
    onChange: (e) => {
      e.target.value = filtro(e.target.value)
      return registro.onChange(e)
    },
  }
}

export const soloDigitos = (max) => (v) => v.replace(/\D/g, '').slice(0, max)

/** Teléfono: dígitos y un "+" inicial opcional (máximo 15 dígitos). */
export const telefono = (v) => {
  const mas = v.trimStart().startsWith('+') ? '+' : ''
  return mas + v.replace(/\D/g, '').slice(0, 15)
}

/** Código dactilar: mayúsculas y solo letras/dígitos, 10 caracteres. */
export const dactilar = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
