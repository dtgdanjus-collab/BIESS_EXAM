import { Icon } from '../../../components/ui'
import { formatoFecha } from '../../../utils/fechas'
import { Dato, Seccion, useFormulario } from '../components'

const CON_CONYUGE = ['CASADO/A', 'UNION DE HECHO']

// 1.1 — Solo lectura: los datos provienen del Registro Civil.
export function PersonalSection() {
  const { postulacion } = useFormulario()
  const d = postulacion.datosPersonales
  const iniciales = `${d.nombres[0] ?? ''}${d.apellidos[0] ?? ''}`.toUpperCase()
  return (
    <Seccion
      id="personal"
      numeral="1.1"
      titulo="Información personal"
      descripcion="Datos obtenidos automáticamente del Registro Civil. No son editables."
    >
      {/* Ficha del postulante */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-brand-50 via-white to-gold-100/40 p-5 ring-1 ring-brand-100 sm:flex-row sm:items-center">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-xl font-extrabold text-gold-200 shadow-glow">
          {iniciales}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold leading-tight tracking-tight text-slate-900">
            {d.nombres} {d.apellidos}
          </p>
          <p className="mt-0.5 font-mono text-sm text-slate-500">C.I. {d.cedula}</p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <Icon name="check" className="size-3.5" strokeWidth={3} />
          Verificado en el Registro Civil
        </span>
      </div>

      <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <Dato etiqueta="Nacionalidad" valor={d.nacionalidad} />
        <Dato etiqueta="Género" valor={d.genero} />
        <Dato etiqueta="Fecha de nacimiento" valor={formatoFecha(d.fechaNacimiento)} />
        <Dato etiqueta="Estado civil" valor={d.estadoCivil} />
      </dl>

      {CON_CONYUGE.includes(d.estadoCivil) && (
        <div className="rounded-2xl border border-slate-200 p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
            <Icon name="users" className="size-[18px] text-brand-600" />
            {d.estadoCivil === 'UNION DE HECHO' ? 'Conviviente' : 'Cónyuge'}
          </p>
          <dl className="grid gap-5 sm:grid-cols-2">
            <Dato etiqueta="Nombres completos" valor={d.conyugeNombres} />
            <Dato etiqueta="Cédula" valor={d.conyugeCedula} />
          </dl>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <Icon name="info" className="mt-px size-4 text-slate-400" />
        Si algún dato es incorrecto, debe actualizarlo en el Registro Civil antes de enviar su postulación.
      </p>
    </Seccion>
  )
}
