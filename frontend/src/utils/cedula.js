// Mismo algoritmo que backend/pkg/validator: 10 dígitos, provincia 01–24 o 30,
// tercer dígito < 6 y dígito verificador por módulo 10.

/** Devuelve el motivo por el que la cédula no es válida, o null si es válida. */
export function errorCedula(cedula) {
  if (!cedula) return 'Ingrese su número de cédula'
  if (!/^\d+$/.test(cedula)) return 'Solo se admiten números'
  if (cedula.length !== 10) return `La cédula tiene 10 dígitos (lleva ${cedula.length})`

  const d = [...cedula].map(Number)
  const provincia = d[0] * 10 + d[1]
  if ((provincia < 1 || provincia > 24) && provincia !== 30) {
    return 'Cédula inválida: los dos primeros dígitos no corresponden a una provincia'
  }
  if (d[2] >= 6) return 'Cédula inválida: el tercer dígito debe ser menor a 6'

  let suma = 0
  for (let i = 0; i < 9; i++) {
    let p = d[i] * (i % 2 === 0 ? 2 : 1)
    if (p > 9) p -= 9
    suma += p
  }
  if ((10 - (suma % 10)) % 10 !== d[9]) return 'Cédula inválida: el dígito verificador no coincide'
  return null
}

export const cedulaValida = (cedula) => errorCedula(cedula) === null
