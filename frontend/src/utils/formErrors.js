/**
 * Lleva los errores por campo del backend (400 → details.campos) al formulario
 * de React Hook Form. Devuelve true si aplicó alguno.
 * mapa permite renombrar campos del backend a los del formulario.
 */
export function aplicarErroresCampos(error, setError, mapa = {}) {
  const campos = error?.details?.campos
  if (!campos) return false
  for (const [campo, mensaje] of Object.entries(campos)) {
    setError(mapa[campo] ?? campo, { type: 'server', message: mensaje })
  }
  return true
}
