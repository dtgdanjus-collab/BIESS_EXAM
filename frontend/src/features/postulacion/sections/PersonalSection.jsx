import { Alert } from '../../../components/ui'
import { formatoFecha } from '../../../utils/fechas'
import { Dato, Seccion, useFormulario } from '../components'

const CON_CONYUGE = ['CASADO/A', 'UNION DE HECHO']

// 1.1 — Solo lectura: los datos provienen del Registro Civil.
export function PersonalSection() {
  const { postulacion } = useFormulario()
  const d = postulacion.datosPersonales
  return (
    <Seccion
      id="personal"
      numeral="1.1"
      titulo="Información personal"
      descripcion="Datos obtenidos automáticamente del Registro Civil. No son editables."
    >
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Dato etiqueta="Cédula" valor={d.cedula} />
        <Dato etiqueta="Nacionalidad" valor={d.nacionalidad} />
        <Dato etiqueta="Nombres" valor={d.nombres} />
        <Dato etiqueta="Apellidos" valor={d.apellidos} />
        <Dato etiqueta="Género" valor={d.genero} />
        <Dato etiqueta="Fecha de nacimiento" valor={formatoFecha(d.fechaNacimiento)} />
        <Dato etiqueta="Estado civil" valor={d.estadoCivil} />
      </dl>
      {CON_CONYUGE.includes(d.estadoCivil) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">
            {d.estadoCivil === 'UNION DE HECHO' ? 'Conviviente' : 'Cónyuge'}
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Nombres completos" valor={d.conyugeNombres} />
            <Dato etiqueta="Cédula" valor={d.conyugeCedula} />
          </dl>
        </div>
      )}
      <Alert type="info">Si algún dato es incorrecto, debe actualizarlo en el Registro Civil.</Alert>
    </Seccion>
  )
}
