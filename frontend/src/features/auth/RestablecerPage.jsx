import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { restablecer } from '../../api/auth'
import { Alert, Button, ErrorAlert } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { aplicarErroresCampos } from '../../utils/formErrors'
import { AuthCard, PasswordInput } from './components'
import { restablecerSchema } from './schemas'

export function RestablecerPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const peticion = useAsync()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(restablecerSchema), defaultValues: { nuevaPassword: '', confirmar: '' } })

  const onSubmit = async (v) => {
    const r = await peticion.run(() => restablecer(token, v.nuevaPassword))
    if (r.ok) return navigate('/login', { replace: true, state: { restablecida: true } })
    aplicarErroresCampos(r.error, setError)
  }

  const pedirOtro = (
    <Link to="/recuperar" className="font-semibold text-brand-700 hover:underline">
      Solicitar un nuevo enlace
    </Link>
  )

  if (!token) {
    return (
      <AuthCard titulo="Enlace inválido" pie={pedirOtro}>
        <Alert type="error">El enlace de recuperación no es válido o está incompleto.</Alert>
      </AuthCard>
    )
  }

  return (
    <AuthCard titulo="Nueva contraseña" subtitulo="Defina la contraseña con la que ingresará al sistema." pie={pedirOtro}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <ErrorAlert error={peticion.error} />
        <PasswordInput
          label="Nueva contraseña"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres, con al menos una letra y un número"
          required
          error={errors.nuevaPassword?.message}
          {...register('nuevaPassword')}
        />
        <PasswordInput
          label="Confirmar contraseña"
          autoComplete="new-password"
          required
          error={errors.confirmar?.message}
          {...register('confirmar')}
        />
        <Button type="submit" className="w-full" loading={peticion.loading}>
          Guardar contraseña
        </Button>
      </form>
    </AuthCard>
  )
}
