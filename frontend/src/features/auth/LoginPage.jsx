import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { login } from '../../api/auth'
import { Alert, Button, ErrorAlert, Input } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useBloqueo } from '../../hooks/useBloqueo'
import { useAuthStore } from '../../store/authStore'
import { aplicarErroresCampos } from '../../utils/formErrors'
import { AuthCard, BloqueoAviso, PasswordInput } from './components'
import { loginSchema } from './schemas'

export function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const guardarSesion = useAuthStore((s) => s.login)
  const peticion = useAsync()
  const bloqueo = useBloqueo()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { cedula: location.state?.cedula ?? '', password: '' },
  })

  const onSubmit = async (valores) => {
    const r = await peticion.run(() => login(valores.cedula, valores.password))
    if (r.ok) {
      guardarSesion(r.data)
      navigate(location.state?.desde ?? '/formulario', { replace: true })
      return
    }
    bloqueo.procesarError(r.error)
    aplicarErroresCampos(r.error, setError)
  }

  const error = peticion.error
  return (
    <AuthCard
      titulo="Iniciar sesión"
      subtitulo="Ingrese con su cédula para continuar con su postulación."
      pie={
        <>
          ¿Aún no tiene cuenta?{' '}
          <Link to="/registro" className="font-semibold text-brand-700 hover:underline">
            Regístrese aquí
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {params.get('expirada') && !error && (
          <Alert type="info">Su sesión expiró. Vuelva a iniciar sesión.</Alert>
        )}
        {location.state?.registrado && !error && (
          <Alert type="success" title="Cuenta creada correctamente">
            Ya puede iniciar sesión con su cédula y contraseña.
          </Alert>
        )}
        {location.state?.restablecida && !error && (
          <Alert type="success">Su contraseña se actualizó. Inicie sesión con la nueva contraseña.</Alert>
        )}
        {error?.status !== 423 && <ErrorAlert error={error} />}
        <BloqueoAviso bloqueo={bloqueo} mensajeBloqueo={error?.message} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <fieldset disabled={bloqueo.bloqueado} className="space-y-4">
            <Input
              label="Número de cédula"
              inputMode="numeric"
              maxLength={10}
              autoComplete="username"
              required
              error={errors.cedula?.message}
              {...register('cedula')}
            />
            <PasswordInput
              label="Contraseña"
              autoComplete="current-password"
              required
              error={errors.password?.message}
              {...register('password')}
            />
          </fieldset>
          <div className="flex justify-end">
            <Link to="/recuperar" className="text-sm font-medium text-brand-700 hover:underline">
              ¿Olvidó su contraseña?
            </Link>
          </div>
          <Button type="submit" className="w-full" loading={peticion.loading} disabled={bloqueo.bloqueado}>
            {bloqueo.bloqueado ? `Bloqueado (${bloqueo.tiempo})` : 'Ingresar'}
          </Button>
        </form>
      </div>
    </AuthCard>
  )
}
