// Mismo algoritmo que backend/pkg/validator: 10 dígitos, provincia 01–24 o 30,
// tercer dígito < 6 y dígito verificador por módulo 10.
export function cedulaValida(cedula) {
  if (!/^\d{10}$/.test(cedula)) return false
  const d = [...cedula].map(Number)
  const provincia = d[0] * 10 + d[1]
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false
  if (d[2] >= 6) return false

  let suma = 0
  for (let i = 0; i < 9; i++) {
    let p = d[i] * (i % 2 === 0 ? 2 : 1)
    if (p > 9) p -= 9
    suma += p
  }
  return (10 - (suma % 10)) % 10 === d[9]
}
