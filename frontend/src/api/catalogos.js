import { api } from './client'

const get = (ruta, params) => api.get(`/catalogos/${ruta}`, { params }).then((r) => r.data)

export const catalogos = {
  paises: () => get('paises'),
  provincias: (paisId) => get('provincias', { pais: paisId }),
  cantones: (provinciaId) => get('cantones', { provincia: provinciaId }),
  parentescos: () => get('parentescos'),
  niveles: () => get('niveles'),
  areas: () => get('areas'),
  sectores: () => get('sectores'),
  inhabilidades: () => get('inhabilidades'),
}
