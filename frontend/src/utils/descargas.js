/** Hace que el navegador guarde un archivo recibido de la API. */
export function guardarArchivo(contenido, nombre) {
  const url = URL.createObjectURL(contenido)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
