// Mismo algoritmo que backend/pkg/validator: 10 dígitos, provincia 01–24 o 30,
// tercer dígito < 6 y dígito verificador por módulo 10.

export const PROVINCIAS = {
  1: 'Azuay',
  2: 'Bolívar',
  3: 'Cañar',
  4: 'Carchi',
  5: 'Cotopaxi',
  6: 'Chimborazo',
  7: 'El Oro',
  8: 'Esmeraldas',
  9: 'Guayas',
  10: 'Imbabura',
  11: 'Loja',
  12: 'Los Ríos',
  13: 'Manabí',
  14: 'Morona Santiago',
  15: 'Napo',
  16: 'Pastaza',
  17: 'Pichincha',
  18: 'Tungurahua',
  19: 'Zamora Chinchipe',
  20: 'Galápagos',
  21: 'Sucumbíos',
  22: 'Orellana',
  23: 'Santo Domingo de los Tsáchilas',
  24: 'Santa Elena',
  30: 'Registrada en el exterior',
}

function verificadorEsperado(d) {
  let suma = 0
  for (let i = 0; i < 9; i++) {
    let p = d[i] * (i % 2 === 0 ? 2 : 1)
    if (p > 9) p -= 9
    suma += p
  }
  return (10 - (suma % 10)) % 10
}

/** Devuelve el motivo por el que la cédula no es válida, o null si es válida. */
export function errorCedula(cedula) {
  if (!cedula) return 'Ingrese su número de cédula'
  if (!/^\d+$/.test(cedula)) return 'Solo se admiten números'
  if (cedula.length !== 10) return `La cédula tiene 10 dígitos (lleva ${cedula.length})`

  const d = [...cedula].map(Number)
  if (!PROVINCIAS[d[0] * 10 + d[1]]) {
    return 'Cédula inválida: los dos primeros dígitos no corresponden a una provincia'
  }
  if (d[2] >= 6) return 'Cédula inválida: el tercer dígito debe ser menor a 6'
  if (verificadorEsperado(d) !== d[9]) return 'Cédula inválida: el dígito verificador no coincide'
  return null
}

export const cedulaValida = (cedula) => errorCedula(cedula) === null

/**
 * Lee por partes una cédula que aún se está escribiendo. Cada parte vale null hasta que tiene
 * sus dígitos: provincia (los 2 primeros), tercero y verificador (el último).
 */
export function leerCedula(cedula = '') {
  const d = [...cedula].map(Number)
  const codigo = d[0] * 10 + d[1]
  return {
    provincia: d.length >= 2 ? { codigo: cedula.slice(0, 2), nombre: PROVINCIAS[codigo] ?? null } : null,
    tercero: d.length >= 3 ? { valor: d[2], valido: d[2] < 6 } : null,
    verificador: d.length === 10 ? { valor: d[9], esperado: verificadorEsperado(d), valido: verificadorEsperado(d) === d[9] } : null,
  }
}
