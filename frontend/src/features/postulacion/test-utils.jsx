import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { catalogos } from '../../api/catalogos'
import { AppRouter } from '../../routes/AppRouter'
import { useAuthStore } from '../../store/authStore'

// Datos y utilidades compartidas por los tests del formulario.

export const postulacionBase = (cambios = {}) => ({
  id: 2,
  codigo: 'BIESS-2026-000002',
  estado: 'BORRADOR',
  motivoCierre: null,
  sectorCodigo: null,
  tieneRespaldo: null,
  organizacionNombre: null,
  tieneFamiliares: null,
  tienePublicaciones: null,
  posibleInhabilidad: false,
  consentimientoAceptado: false,
  fechaEnvio: null,
  datosConfirmadosEn: '2026-01-15T10:00:00Z',
  datosPersonales: {
    cedula: '0102345675',
    nombres: 'María Fernanda',
    apellidos: 'Ortega Vásquez',
    genero: 'FEMENINO',
    fechaNacimiento: '1985-04-12',
    nacionalidad: 'ECUATORIANA',
    estadoCivil: 'SOLTERO/A',
    conyugeNombres: null,
    conyugeCedula: null,
  },
  contacto: null,
  familiares: [],
  formacion: [],
  experiencia: [],
  experienciaTotal: null,
  publicaciones: [],
  capacitaciones: [],
  inhabilidades: [],
  ...cambios,
})

export const SECTORES = [
  {
    codigo: 'AFILIADOS',
    cargo: 'Miembro en Representación del Sector de Afiliados',
    tipoRequerido: 'AFILIADO',
    etiquetaCumple: 'Postulante afiliado al IESS',
    etiquetaNoCumple: 'Postulante No Afiliado al IESS',
    mensajeRechazo: 'NO puede continuar, no es afiliado',
    preguntaRespaldo: '¿Se encuentra respaldado por una organización de trabajadores?',
  },
  {
    codigo: 'JUBILADOS',
    cargo: 'Miembro en Representación del Sector de los Jubilados',
    tipoRequerido: 'JUBILADO',
    etiquetaCumple: 'Postulante acredita jubilación',
    etiquetaNoCumple: 'Postulante no acredita jubilación',
    mensajeRechazo: 'NO puede continuar, no acredita jubilación',
    preguntaRespaldo: '¿Se encuentra respaldado por una organización de jubilados?',
  },
]

export function mockCatalogos() {
  catalogos.paises.mockResolvedValue([
    { id: 52, nombre: 'Ecuador' },
    { id: 59, nombre: 'España' },
  ])
  catalogos.provincias.mockImplementation(async (pais) =>
    pais === '52' || pais === 52 ? [{ id: 1, nombre: 'Azuay' }, { id: 9, nombre: 'Guayas' }] : [],
  )
  catalogos.cantones.mockImplementation(async (prov) =>
    String(prov) === '1' ? [{ id: 1, nombre: 'Cuenca' }, { id: 2, nombre: 'Gualaceo' }] : [{ id: 70, nombre: 'Guayaquil' }],
  )
  catalogos.parentescos.mockResolvedValue([{ id: 4, nombre: 'Hermano/a' }])
  catalogos.sectores.mockResolvedValue(SECTORES)
  catalogos.niveles.mockResolvedValue([{ id: 3, nombre: 'Cuarto Nivel - Maestría Académica', orden: 3 }])
  catalogos.areas.mockResolvedValue([{ id: 1, nombre: 'Finanzas' }])
  catalogos.inhabilidades.mockResolvedValue([])
}

export function abrirFormulario(seccion) {
  useAuthStore.getState().login({
    token: 'jwt',
    expiraEn: new Date(Date.now() + 3_600_000).toISOString(),
    usuario: { id: 1, cedula: '0102345675', nombres: 'María Fernanda', apellidos: 'Ortega Vásquez' },
  })
  const ruta = seccion ? `/formulario?seccion=${seccion}` : '/formulario'
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AppRouter />
    </MemoryRouter>,
  )
}

