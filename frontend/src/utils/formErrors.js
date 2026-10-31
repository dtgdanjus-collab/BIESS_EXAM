/**
 * Lleva los errores por campo del backend (400 → details.campos) al formulario
 * de React Hook Form. Devuelve true si aplicó alguno.
 * Convierte las rutas de listas del backend ("items[0].cargo") a las de RHF ("items.0.cargo").
 * mapa permite renombrar campos del backend a los del formulario.
 */
export function aplicarErroresCampos(error, setError, mapa = {}) {
  const campos = error?.details?.campos
  if (!campos) return false
  for (const [campo, mensaje] of Object.entries(campos)) {
    const ruta = mapa[campo] ?? campo.replace(/\[(\d+)\]/g, '.$1')
    setError(ruta, { type: 'server', message: mensaje })
  }
  return true
}
