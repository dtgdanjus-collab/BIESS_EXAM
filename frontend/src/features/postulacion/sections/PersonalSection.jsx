import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Button, Card, ErrorAlert, Input, Modal, Select } from '../../../components/ui'
import { useAuthStore } from '../../../store/authStore'
import { formatoFecha, hoyIso } from '../../../utils/fechas'
import { conFiltro, soloDigitos } from '../../../utils/filtros'
import { CeldasCedula, Dato, Grupo, Seccion, opcional, useFormulario, useGuardarSeccion } from '../components'
import { CON_CONYUGE, datosPersonalesSchema } from '../schemas'

const GENEROS = [
  { id: 'FEMENINO', nombre: 'Femenino' },
  { id: 'MASCULINO', nombre: 'Masculino' },
]
const ESTADOS_CIVILES = [
  { id: 'SOLTERO/A', nombre: 'Soltero/a' },
  { id: 'CASADO/A', nombre: 'Casado/a' },
  { id: 'DIVORCIADO/A', nombre: 'Divorciado/a' },
  { id: 'VIUDO/A', nombre: 'Viudo/a' },
  { id: 'UNION DE HECHO', nombre: 'Unión de hecho' },
]

const etiquetaConyuge = (estadoCivil) => (estadoCivil === 'UNION DE HECHO' ? 'conviviente' : 'cónyuge')

/** Antes de confirmar: los datos se revisan y se corrigen aquí mismo, una sola vez. */
function FormularioDatos({ d }) {
  const peticion = useGuardarSeccion()
  const usuario = useAuthStore((s) => s.usuario)
  const setUsuario = useAuthStore((s) => s.setUsuario)
  const [revisados, setRevisados] = useState(null)
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(datosPersonalesSchema),
    mode: 'onTouched',
    defaultValues: {
      nombres: d.nombres,
      apellidos: d.apellidos,
      genero: d.genero,
      fechaNacimiento: d.fechaNacimiento,
      estadoCivil: d.estadoCivil,
      conyugeNombres: d.conyugeNombres ?? '',
      conyugeCedula: d.conyugeCedula ?? '',
    },
  })
  const estadoCivil = watch('estadoCivil')

  const confirmar = async () => {
    const v = revisados
    setRevisados(null)
    const conConyuge = CON_CONYUGE.includes(v.estadoCivil)
    const r = await peticion.guardar(
      () =>
        postulacionApi.datosPersonales({
          ...v,
          conyugeNombres: conConyuge ? opcional(v.conyugeNombres) : null,
          conyugeCedula: conConyuge ? opcional(v.conyugeCedula) : null,
        }),
      setError,
    )
    // El perfil de la barra lateral muestra estos mismos nombres.
    if (r.ok && usuario) setUsuario({ ...usuario, nombres: v.nombres.trim(), apellidos: v.apellidos.trim() })
  }

  return (
    <form onSubmit={handleSubmit(setRevisados)} noValidate>
      <Card
        numeral="1.1"
        title="Información personal"
        description="Estos datos vienen del Registro Civil y pueden no coincidir con los suyos. Revíselos y corrija lo que haga falta."
        pie={
          <>
            {peticion.error && !peticion.error.details?.campos && <ErrorAlert error={peticion.error} />}
            {peticion.error?.details?.campos && <Alert type="error">Revise los campos marcados en rojo.</Alert>}
            <div className="flex justify-end">
              <Button type="submit" loading={peticion.loading} className="w-full sm:w-auto">
                Guardar
              </Button>
            </div>
          </>
        }
      >
        <fieldset disabled={peticion.loading} className="space-y-8">
          <Alert type="warning" title="Solo podrá hacerlo una vez">
            Al confirmar, estos datos quedan fijos y ya no se podrán cambiar.
          </Alert>

          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div className="min-w-60 flex-1">
              <p className="mb-1.5 text-xs text-tenue">Cédula, no se puede cambiar</p>
              <CeldasCedula cedula={d.cedula} />
            </div>
            <dl>
              <Dato etiqueta="Nacionalidad, no se puede cambiar" valor={d.nacionalidad} />
            </dl>
          </div>

          <Grupo titulo="Sus datos">
            <Input label="Nombres" autoComplete="given-name" maxLength={100} required error={errors.nombres?.message} {...register('nombres')} />
            <Input label="Apellidos" autoComplete="family-name" maxLength={100} required error={errors.apellidos?.message} {...register('apellidos')} />
            <Input
              label="Fecha de nacimiento"
              type="date"
              autoComplete="bday"
              min="1900-01-01"
              max={hoyIso()}
              required
              error={errors.fechaNacimiento?.message}
              {...register('fechaNacimiento')}
            />
            <Select label="Género" required options={GENEROS} error={errors.genero?.message} {...register('genero')} />
            <Select label="Estado civil" required options={ESTADOS_CIVILES} error={errors.estadoCivil?.message} {...register('estadoCivil')} />
          </Grupo>

          {CON_CONYUGE.includes(estadoCivil) && (
            <div className="grid gap-4 rounded-md bg-fondo p-4 sm:grid-cols-2 animate-slide-down">
              <Input
                label={`Nombres completos del ${etiquetaConyuge(estadoCivil)}`}
                maxLength={200}
                required
                error={errors.conyugeNombres?.message}
                {...register('conyugeNombres')}
              />
              <Input
                label={`Cédula del ${etiquetaConyuge(estadoCivil)}`}
                inputMode="numeric"
                maxLength={10}
                required
                error={errors.conyugeCedula?.message}
                {...conFiltro(register('conyugeCedula'), soloDigitos(10))}
              />
            </div>
          )}
        </fieldset>
      </Card>

      <Modal
        open={revisados !== null}
        onClose={() => setRevisados(null)}
        title="¿Confirmar sus datos personales?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevisados(null)}>
              Revisar de nuevo
            </Button>
            <Button onClick={confirmar}>Sí, confirmar</Button>
          </>
        }
      >
        {revisados && (
          <>
            <strong className="font-medium text-tinta">
              {revisados.nombres} {revisados.apellidos}
            </strong>
            , nacimiento el <strong className="font-medium text-tinta">{formatoFecha(revisados.fechaNacimiento)}</strong>. Después de confirmar
            no podrá cambiar estos datos.
          </>
        )}
      </Modal>
    </form>
  )
}

// 1.1 — Se corrige una sola vez; después es de solo lectura.
export function PersonalSection() {
  const { postulacion, soloLectura } = useFormulario()
  const d = postulacion.datosPersonales
  const confirmados = Boolean(postulacion.datosConfirmadosEn)

  if (!confirmados && !soloLectura) return <FormularioDatos d={d} />

  return (
    <Seccion
      id="personal"
      numeral="1.1"
      titulo="Información personal"
      descripcion="Sus datos quedaron fijos al confirmarlos y ya no se pueden modificar."
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-2xl font-medium leading-tight tracking-tight">
            {d.nombres} {d.apellidos}
          </p>
          <div className="mt-3">
            <CeldasCedula cedula={d.cedula} />
          </div>
        </div>
        {confirmados && (
          <span className="inline-flex h-6 flex-none items-center whitespace-nowrap rounded bg-ok-fondo px-2 text-xs font-medium text-ok-tinta">
            Datos confirmados
          </span>
        )}
      </div>

      <dl className="grid gap-px overflow-hidden rounded-md bg-regla sm:grid-cols-2 lg:grid-cols-4 [&>div]:bg-[#fafafa] [&>div]:p-3">
        <Dato etiqueta="Nacionalidad" valor={d.nacionalidad} />
        <Dato etiqueta="Género" valor={d.genero} />
        <Dato etiqueta="Fecha de nacimiento" valor={formatoFecha(d.fechaNacimiento)} />
        <Dato etiqueta="Estado civil" valor={d.estadoCivil} />
      </dl>

      {CON_CONYUGE.includes(d.estadoCivil) && (
        <div className="rounded-md bg-fondo p-4">
          <p className="mb-3 text-sm font-medium">{d.estadoCivil === 'UNION DE HECHO' ? 'Conviviente' : 'Cónyuge'}</p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Nombres completos" valor={d.conyugeNombres} />
            <Dato etiqueta="Cédula" valor={d.conyugeCedula} />
          </dl>
        </div>
      )}
    </Seccion>
  )
}
