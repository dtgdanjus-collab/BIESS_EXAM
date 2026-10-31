import { useState } from 'react'
import { Alert, Input } from '../../components/ui'

export function AuthCard({ titulo, subtitulo, children, pie }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-6 pb-6 pt-7 sm:px-8">
        <h1 className="text-xl font-bold text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {pie && (
        <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50 px-6 py-4 text-center text-sm text-slate-600 sm:px-8">
          {pie}
        </div>
      )}
    </div>
  )
}

export function PasswordInput({ ref, className = '', ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className={`[&_input]:pr-20 ${className}`} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-[30px] rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  )
}

/**
 * Campos de validación de identidad: cédula + fecha de expedición o código dactilar.
 * Se usa en el registro y en la recuperación de contraseña.
 */
export function IdentidadFields({ register, errors, metodo, setValue, disabled }) {
  const opcion = (valor, texto) => (
    <button
      type="button"
      role="radio"
      aria-checked={metodo === valor}
      disabled={disabled}
      onClick={() => setValue('metodo', valor, { shouldValidate: false })}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        metodo === valor ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {texto}
    </button>
  )

  return (
    <div className="space-y-4">
      <Input
        label="Número de cédula"
        inputMode="numeric"
        maxLength={10}
        autoComplete="username"
        placeholder="0102345675"
        required
        disabled={disabled}
        error={errors.cedula?.message}
        {...register('cedula')}
      />
      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Validar con</p>
        <div role="radiogroup" className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {opcion('fecha', 'Fecha de expedición')}
          {opcion('dactilar', 'Código dactilar')}
        </div>
      </div>
      {metodo === 'fecha' ? (
        <Input
          label="Fecha de expedición de la cédula"
          type="date"
          required
          disabled={disabled}
          max={new Date().toISOString().slice(0, 10)}
          error={errors.fechaExpedicion?.message}
          {...register('fechaExpedicion')}
        />
      ) : (
        <Input
          label="Código dactilar"
          placeholder="V4443V4442"
          maxLength={10}
          autoCapitalize="characters"
          className="[&_input]:uppercase"
          hint="Se encuentra en el reverso de la cédula"
          required
          disabled={disabled}
          error={errors.codigoDactilar?.message}
          {...register('codigoDactilar')}
        />
      )}
    </div>
  )
}

/** Aviso de intentos restantes o de bloqueo temporal con cuenta regresiva. */
export function BloqueoAviso({ bloqueo, mensajeBloqueo }) {
  if (bloqueo.bloqueado) {
    return (
      <Alert type="error" title={mensajeBloqueo}>
        Podrá intentarlo de nuevo en{' '}
        <span className="font-mono text-base font-bold tabular-nums" aria-live="polite">
          {bloqueo.tiempo}
        </span>
      </Alert>
    )
  }
  if (bloqueo.intentosRestantes !== null) {
    return (
      <Alert type="warning">
        {bloqueo.intentosRestantes === 1
          ? 'Le queda 1 intento antes del bloqueo temporal.'
          : `Le quedan ${bloqueo.intentosRestantes} intentos antes del bloqueo temporal.`}
      </Alert>
    )
  }
  return null
}
