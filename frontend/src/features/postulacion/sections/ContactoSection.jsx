import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { postulacionApi } from '../../../api/postulacion'
import { Alert, Input } from '../../../components/ui'
import { useCatalogo } from '../../../hooks/useCatalogo'
import { conFiltro, telefono } from '../../../utils/filtros'
import { useAuthStore } from '../../../store/authStore'
import { AccionesGuardado, CampoSelect, Dato, Grupo, Seccion, opcional, useFormulario, useGuardarSeccion } from '../components'
import { contactoSchema } from '../schemas'

const str = (v) => (v === null || v === undefined ? '' : String(v))

// 1.2.5: el correo 1 sale del registro hasta que el postulante guarde otro.
const valoresDe = (c, correoRegistrado) => ({
  paisId: str(c?.paisId),
  provinciaId: str(c?.provinciaId),
  cantonId: str(c?.cantonId),
  provinciaTexto: c?.provinciaTexto ?? '',
  ciudadTexto: c?.ciudadTexto ?? '',
  telefonoCelular: c?.telefonoCelular ?? '',
  telefonoDomicilio: c?.telefonoDomicilio ?? '',
  correo1: c?.correo1 ?? correoRegistrado ?? '',
  correo2: c?.correo2 ?? '',
  callePrincipal: c?.callePrincipal ?? '',
  numero: c?.numero ?? '',
  calleSecundaria: c?.calleSecundaria ?? '',
  sector: c?.sector ?? '',
  referencia: c?.referencia ?? '',
})

// 1.2 — Domicilio con cascada País → Provincia → Ciudad.
export function ContactoSection() {
  const { postulacion } = useFormulario()
  const c = postulacion.contacto
  const correoRegistrado = useAuthStore((s) => s.usuario?.email)
  const [editando, setEditando] = useState(!c)
  const paises = useCatalogo('paises')
  const ecuadorId = paises.data.find((p) => p.nombre === 'Ecuador')?.id
  const schema = useMemo(() => contactoSchema(ecuadorId), [ecuadorId])
  const peticion = useGuardarSeccion()

  const { register, control, handleSubmit, watch, setValue, setError, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: valoresDe(c, correoRegistrado),
  })

  // Ecuador por defecto cuando aún no hay domicilio guardado.
  useEffect(() => {
    if (ecuadorId && !watch('paisId')) setValue('paisId', String(ecuadorId))
  }, [ecuadorId, setValue, watch])

  const paisId = watch('paisId')
  const provinciaId = watch('provinciaId')
  const esEcuador = Boolean(ecuadorId) && paisId === String(ecuadorId)
  const provincias = useCatalogo('provincias', esEcuador ? paisId : null)
  const cantones = useCatalogo('cantones', esEcuador ? provinciaId : null)

  // Al cambiar un nivel de la cascada se limpian los niveles inferiores.
  const alCambiarPais = () => {
    for (const campo of ['provinciaId', 'cantonId', 'provinciaTexto', 'ciudadTexto']) setValue(campo, '')
  }
  const alCambiarProvincia = () => setValue('cantonId', '')

  const onSubmit = handleSubmit(async (v) => {
    const r = await peticion.guardar(
      () =>
        postulacionApi.contacto({
          paisId: Number(v.paisId),
          provinciaId: esEcuador ? Number(v.provinciaId) : null,
          cantonId: esEcuador ? Number(v.cantonId) : null,
          provinciaTexto: esEcuador ? null : opcional(v.provinciaTexto),
          ciudadTexto: esEcuador ? null : opcional(v.ciudadTexto),
          telefonoCelular: v.telefonoCelular.trim(),
          telefonoDomicilio: opcional(v.telefonoDomicilio),
          correo1: v.correo1.trim(),
          correo2: opcional(v.correo2),
          callePrincipal: v.callePrincipal.trim(),
          numero: opcional(v.numero),
          calleSecundaria: opcional(v.calleSecundaria),
          sector: opcional(v.sector),
          referencia: opcional(v.referencia),
        }),
      setError,
    )
    if (r.ok) setEditando(false)
  })

  const eliminar = async () => {
    const r = await peticion.guardar(postulacionApi.eliminarContacto)
    if (r.ok) {
      reset({ ...valoresDe(null, correoRegistrado), paisId: str(ecuadorId) })
      setEditando(true)
      peticion.reset()
    }
  }

  const base = {
    id: 'contacto',
    numeral: '1.2',
    titulo: 'Información domiciliaria y de contacto',
    descripcion: 'Lugar de residencia actual y medios para comunicarnos con usted.',
    peticion,
    onSubmit,
  }

  if (c && !editando) {
    const nombreDe = (lista, id) => lista.find((x) => x.id === id)?.nombre
    return (
      <Seccion {...base} ocultarGuardar>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="País" valor={nombreDe(paises.data, c.paisId)} />
          <Dato etiqueta="Provincia / Estado" valor={c.provinciaTexto ?? nombreDe(provincias.data, c.provinciaId)} />
          <Dato etiqueta="Ciudad" valor={c.ciudadTexto ?? nombreDe(cantones.data, c.cantonId)} />
          <Dato etiqueta="Teléfono celular" valor={c.telefonoCelular} />
          <Dato etiqueta="Correo electrónico 1" valor={c.correo1} />
          <Dato etiqueta="Correo electrónico 2" valor={c.correo2} />
          <Dato etiqueta="Calle principal domicilio" valor={c.callePrincipal} />
          <Dato etiqueta="Número" valor={c.numero} />
          <Dato etiqueta="Calle secundaria" valor={c.calleSecundaria} />
          <Dato etiqueta="Sector" valor={c.sector} />
          <Dato etiqueta="Referencia" valor={c.referencia} />
          <Dato etiqueta="Teléfono domicilio" valor={c.telefonoDomicilio} />
        </dl>
        <AccionesGuardado
          onEditar={() => {
            peticion.reset()
            setEditando(true)
          }}
          onEliminar={eliminar}
          titulo="¿Eliminar la información domiciliaria?"
          mensaje="Se borrarán su domicilio y sus datos de contacto. Deberá ingresarlos otra vez antes de enviar."
        />
      </Seccion>
    )
  }

  return (
    <Seccion {...base} textoGuardar="Guardar">
      {paises.error && <Alert type="error">No se pudo cargar el catálogo de países.</Alert>}

      <Grupo titulo="Lugar de residencia" className="grid gap-4 sm:grid-cols-3">
        <CampoSelect
          control={control}
          name="paisId"
          label="País"
          required
          options={paises.data}
          loading={paises.loading}
          onCambio={alCambiarPais}
        />
        {esEcuador ? (
          <>
            <CampoSelect
              control={control}
              name="provinciaId"
              label="Provincia / Estado"
              required
              options={provincias.data}
              loading={provincias.loading}
              onCambio={alCambiarProvincia}
            />
            <CampoSelect
              control={control}
              name="cantonId"
              label="Ciudad"
              required
              options={cantones.data}
              loading={cantones.loading}
              disabled={!provinciaId}
              placeholder={provinciaId ? 'Seleccione…' : 'Primero elija la provincia'}
            />
          </>
        ) : (
          <>
            <Input label="Provincia / Estado" required error={errors.provinciaTexto?.message} {...register('provinciaTexto')} />
            <Input label="Ciudad" required error={errors.ciudadTexto?.message} {...register('ciudadTexto')} />
          </>
        )}
      </Grupo>

      <Grupo titulo="Dirección">
        <Input label="Calle principal domicilio" required error={errors.callePrincipal?.message} {...register('callePrincipal')} />
        <Input label="Número" error={errors.numero?.message} {...register('numero')} />
        <Input label="Calle secundaria" error={errors.calleSecundaria?.message} {...register('calleSecundaria')} />
        <Input label="Sector" error={errors.sector?.message} {...register('sector')} />
        <Input
          label="Referencia"
          className="sm:col-span-2"
          error={errors.referencia?.message}
          {...register('referencia')}
        />
      </Grupo>

      <Grupo titulo="Cómo comunicarnos con usted">
        <Input
          label="Teléfono celular"
          type="tel"
          inputMode="tel"
          placeholder="0991234567"
          autoComplete="tel"
          required
          error={errors.telefonoCelular?.message}
          {...conFiltro(register('telefonoCelular'), telefono)}
        />
        <Input
          label="Teléfono domicilio"
          type="tel"
          inputMode="tel"
          error={errors.telefonoDomicilio?.message}
          {...conFiltro(register('telefonoDomicilio'), telefono)}
        />
        <Input label="Correo electrónico 1" type="email" autoComplete="email" required error={errors.correo1?.message} {...register('correo1')} />
        <Input label="Correo electrónico 2" type="email" error={errors.correo2?.message} {...register('correo2')} />
      </Grupo>
    </Seccion>
  )
}
