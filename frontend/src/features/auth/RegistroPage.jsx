import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { registrar, verificarIdentidad } from '../../api/auth'
import { Alert, Button, ErrorAlert, Icon, Input } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useBloqueo } from '../../hooks/useBloqueo'
import { aplicarErroresCampos } from '../../utils/formErrors'
import {
  AuthCard,
  BloqueoAviso,
  IdentidadFields,
  PasswordInput,
  PersonasPrueba,
  ReglasPassword,
  usarPersona,
} from './components'
import { cuentaSchema, identidadPayload, identidadSchema } from './schemas'

function Pasos({ paso }) {
  const item = (n, texto) => (
    <li className="flex-1">
      <div className={`h-1.5 rounded-full transition-colors duration-500 ${paso >= n ? 'bg-brand-600' : 'bg-slate-200'}`} />
      <p className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${paso >= n ? 'text-brand-800' : 'text-slate-400'}`}>
        {paso > n ? (
          <Icon name="check" className="size-3.5" strokeWidth={3} />
        ) : (
          <span className="tabular-nums">{n}.</span>
        )}
        {texto}
      </p>
    </li>
  )
  return (
    <ol className="mb-7 flex gap-3" aria-label={`Paso ${paso} de 2`}>
      {item(1, 'Validar identidad')}
      {item(2, 'Crear cuenta')}
    </ol>
  )
}

/** Paso 1: validación contra el Registro Civil (con bloqueo de 3 intentos). */
function PasoIdentidad({ onValidado }) {
  const peticion = useAsync()
  const bloqueo = useBloqueo()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(identidadSchema),
    mode: 'onTouched',
    defaultValues: { cedula: '', metodo: 'fecha', fechaExpedicion: '', codigoDactilar: '' },
  })

  const onSubmit = async (v) => {
    const r = await peticion.run(() => verificarIdentidad(identidadPayload(v)))
    if (r.ok) return onValidado({ token: r.data.registroToken, cedula: v.cedula })
    bloqueo.procesarError(r.error)
    aplicarErroresCampos(r.error, setError)
  }

  const error = peticion.error
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error?.status === 409 ? (
        <Alert type="warning" title={error.message}>
          <Link to="/login" className="font-semibold underline">
            Inicie sesión
          </Link>{' '}
          o{' '}
          <Link to="/recuperar" className="font-semibold underline">
            recupere su contraseña
          </Link>
          .
        </Alert>
      ) : (
        error?.status !== 423 && <ErrorAlert error={error} />
      )}
      <BloqueoAviso bloqueo={bloqueo} mensajeBloqueo={error?.message} />

      <fieldset disabled={bloqueo.bloqueado}>
        <IdentidadFields
          register={register}
          errors={errors}
          metodo={watch('metodo')}
          cedula={watch('cedula')}
          setValue={setValue}
          disabled={bloqueo.bloqueado}
        />
      </fieldset>
      <Button type="submit" className="w-full" loading={peticion.loading} disabled={bloqueo.bloqueado}>
        {bloqueo.bloqueado ? `Bloqueado (${bloqueo.tiempo})` : 'Validar identidad'}
      </Button>
      <PersonasPrueba onUsar={usarPersona(setValue, clearErrors)} />
    </form>
  )
}

/** Paso 2: correo y contraseña. El token del paso 1 dura 10 minutos. */
function PasoCuenta({ registroToken, onExpirado, onRegistrado }) {
  const peticion = useAsync()
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(cuentaSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '', confirmar: '' },
  })

  const onSubmit = async (v) => {
    const r = await peticion.run(() => registrar({ registroToken, email: v.email, password: v.password }))
    if (r.ok) return onRegistrado()
    if (r.error.code === 'NO_AUTORIZADO') return onExpirado(r.error.message)
    if (r.error.details?.campo === 'email') setError('email', { message: r.error.message })
    aplicarErroresCampos(r.error, setError)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Alert type="success">Identidad validada. Ahora cree sus credenciales de acceso.</Alert>
      {peticion.error?.details?.campo !== 'email' && <ErrorAlert error={peticion.error} />}
      <Input
        label="Correo electrónico"
        icono="mail"
        type="email"
        autoComplete="email"
        placeholder="nombre@correo.com"
        maxLength={150}
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <PasswordInput
        label="Contraseña"
        autoComplete="new-password"
        maxLength={72}
        required
        error={errors.password?.message}
        {...register('password', { deps: ['confirmar'] })}
      />
      <ReglasPassword valor={watch('password')} />
      <PasswordInput
        label="Confirmar contraseña"
        autoComplete="new-password"
        required
        error={errors.confirmar?.message}
        {...register('confirmar')}
      />
      <Button type="submit" className="w-full" loading={peticion.loading}>
        Crear cuenta
      </Button>
    </form>
  )
}

export function RegistroPage() {
  const navigate = useNavigate()
  const [validacion, setValidacion] = useState(null) // { token, cedula }
  const [aviso, setAviso] = useState(null)

  return (
    <AuthCard
      titulo="Registro de postulante"
      icono="id"
      subtitulo="Valide su identidad con los datos de su cédula."
      pie={
        <>
          ¿Ya tiene cuenta?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Inicie sesión
          </Link>
        </>
      }
    >
      <Pasos paso={validacion ? 2 : 1} />
      {aviso && (
        <Alert type="warning" className="mb-4">
          {aviso}
        </Alert>
      )}
      {validacion ? (
        <PasoCuenta
          registroToken={validacion.token}
          onExpirado={(msg) => {
            setValidacion(null)
            setAviso(msg)
          }}
          onRegistrado={() =>
            navigate('/login', { replace: true, state: { registrado: true, cedula: validacion.cedula } })
          }
        />
      ) : (
        <PasoIdentidad
          onValidado={(v) => {
            setAviso(null)
            setValidacion(v)
          }}
        />
      )}
    </AuthCard>
  )
}
