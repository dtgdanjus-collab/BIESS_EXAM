import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { recuperar } from '../../api/auth'
import { Alert, Button, ErrorAlert } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useBloqueo } from '../../hooks/useBloqueo'
import { aplicarErroresCampos } from '../../utils/formErrors'
import { AuthCard, BloqueoAviso, IdentidadFields } from './components'
import { identidadPayload, identidadSchema } from './schemas'

export function RecuperarPage() {
  const peticion = useAsync()
  const bloqueo = useBloqueo()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(identidadSchema),
    defaultValues: { cedula: '', metodo: 'fecha', fechaExpedicion: '', codigoDactilar: '' },
  })

  const onSubmit = async (v) => {
    const r = await peticion.run(() => recuperar(identidadPayload(v)))
    if (!r.ok) {
      bloqueo.procesarError(r.error)
      aplicarErroresCampos(r.error, setError)
    }
  }

  const volver = (
    <Link to="/login" className="font-semibold text-brand-700 hover:underline">
      Volver a iniciar sesión
    </Link>
  )

  if (peticion.success) {
    return (
      <AuthCard titulo="Revise su correo" icono="send" pie={volver}>
        <Alert type="success" title="Enlace enviado">
          {peticion.data.message}. El enlace es válido por 15 minutos.
        </Alert>
        <p className="mt-4 text-xs text-slate-500">
          Entorno de demostración: el correo se simula y el enlace aparece en el log del backend.
        </p>
      </AuthCard>
    )
  }

  const error = peticion.error
  return (
    <AuthCard
      titulo="Recuperar contraseña"
      icono="mail"
      subtitulo="Valide su identidad y le enviaremos un enlace a su correo registrado."
      pie={volver}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error?.status === 404 ? (
          <Alert type="warning" title={error.message}>
            <Link to="/registro" className="font-semibold underline">
              Regístrese aquí
            </Link>
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
            setValue={setValue}
            disabled={bloqueo.bloqueado}
          />
        </fieldset>
        <Button type="submit" className="w-full" loading={peticion.loading} disabled={bloqueo.bloqueado}>
          {bloqueo.bloqueado ? `Bloqueado (${bloqueo.tiempo})` : 'Enviar enlace'}
        </Button>
      </form>
    </AuthCard>
  )
}
