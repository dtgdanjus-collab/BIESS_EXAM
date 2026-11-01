import { useState } from 'react'
import { Icon, Input } from '../../components/ui'
import { cedulaValida } from '../../utils/cedula'
import { conFiltro, dactilar, soloDigitos } from '../../utils/filtros'
import { PERSONAS_PRUEBA } from './personasPrueba'
import { REGLAS_PASSWORD } from './schemas'

export function AuthCard({ titulo, subtitulo, icono = 'lock', children, pie }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-slate-900/5">
      <div className="px-6 pb-7 pt-8 sm:px-9">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/70">
          <Icon name={icono} className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{subtitulo}</p>}
        <div className="mt-7">{children}</div>
      </div>
      {pie && (
        <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 text-center text-sm text-slate-600 sm:px-9">
          {pie}
        </div>
      )}
    </div>
  )
}

export function PasswordInput({ ref, ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      icono="lock"
      suffix={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
          aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} className="size-[18px]" />
        </button>
      }
      {...props}
    />
  )
}

/** Campo de cédula: solo dígitos y ✔ cuando el número es válido (módulo 10). */
export function CampoCedula({ register, error, valor, disabled }) {
  const valida = !error && cedulaValida(valor ?? '')
  return (
    <Input
      label="Número de cédula"
      inputMode="numeric"
      maxLength={10}
      autoComplete="username"
      placeholder="0102345675"
      icono="id"
      required
      disabled={disabled}
      error={error}
      hint={valida ? 'Cédula válida' : '10 dígitos, sin guiones'}
      suffix={
        valida && (
          <span className="mr-2 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden="true">
            <Icon name="check" className="size-3.5" strokeWidth={3} />
          </span>
        )
      }
      {...conFiltro(register('cedula'), soloDigitos(10))}
    />
  )
}

/** Lista de requisitos de la contraseña que se marcan mientras el usuario escribe. */
export function ReglasPassword({ valor = '' }) {
  return (
    <ul className="grid gap-1.5 rounded-xl bg-slate-50 px-4 py-3 sm:grid-cols-3" aria-label="Requisitos de la contraseña">
      {REGLAS_PASSWORD.map((r) => {
        const ok = r.cumple(valor)
        return (
          <li key={r.texto} className={`flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
            <span
              className={`flex size-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                ok ? 'bg-emerald-500 text-white' : 'border border-slate-300'
              }`}
            >
              {ok && <Icon name="check" className="size-2.5" strokeWidth={4} />}
            </span>
            {r.texto}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Entorno de demostración: el Registro Civil es simulado y solo conoce a las personas
 * ficticias de los datos semilla. Este panel las muestra y permite usarlas con un clic.
 */
export function PersonasPrueba({ onUsar }) {
  return (
    <details className="group rounded-2xl border border-gold-200 bg-gold-100/50 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-gold-600 [&::-webkit-details-marker]:hidden">
        <Icon name="sparkles" className="size-4" />
        <span className="rounded-md bg-gold-300 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-950">Demo</span>
        Personas de prueba
        <Icon name="chevronRight" className="ml-auto size-4 transition-transform group-open:rotate-90" strokeWidth={2.2} />
      </summary>
      <div className="space-y-2 border-t border-gold-200 px-4 py-3">
        <p className="text-xs leading-relaxed text-slate-600">
          El Registro Civil está simulado: solo reconoce estas personas ficticias. Una cédula real, aunque sea válida,
          responderá "La información ingresada es incorrecta".
        </p>
        <ul className="divide-y divide-gold-200/70">
          {PERSONAS_PRUEBA.map((p) => (
            <li key={p.cedula} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-mono text-[13px] font-bold text-slate-800">{p.cedula}</p>
                <p className="truncate text-xs text-slate-500">
                  {p.escenario} · exp. {p.fecha.split('-').reverse().join('/')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUsar(p)}
                className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-xs ring-1 ring-slate-200 transition-colors hover:bg-brand-600 hover:text-white"
                aria-label={`Usar la persona de prueba ${p.cedula}`}
              >
                Usar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

/** Llena el formulario de identidad con una persona de prueba (por fecha de expedición). */
export const usarPersona = (setValue, clearErrors) => (p) => {
  setValue('cedula', p.cedula, { shouldValidate: true })
  setValue('metodo', 'fecha')
  setValue('fechaExpedicion', p.fecha, { shouldValidate: true })
  setValue('codigoDactilar', p.dactilar)
  clearErrors?.()
}

/**
 * Campos de validación de identidad: cédula + fecha de expedición o código dactilar.
 * Se usa en el registro y en la recuperación de contraseña.
 */
export function IdentidadFields({ register, errors, metodo, setValue, disabled, cedula }) {
  const opcion = (valor, texto, icono) => (
    <button
      type="button"
      role="radio"
      aria-checked={metodo === valor}
      disabled={disabled}
      onClick={() => setValue('metodo', valor, { shouldValidate: false })}
      className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-semibold transition-all sm:px-3 ${
        metodo === valor
          ? 'bg-white text-brand-800 shadow-sm ring-1 ring-slate-900/5'
          : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      <Icon name={icono} className="hidden size-4 min-[420px]:block" />
      {texto}
    </button>
  )

  return (
    <div className="space-y-5">
      <CampoCedula register={register} error={errors.cedula?.message} valor={cedula} disabled={disabled} />
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-slate-700">Validar con</p>
        <div role="radiogroup" className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {opcion('fecha', 'Fecha de expedición', 'calendar')}
          {opcion('dactilar', 'Código dactilar', 'fingerprint')}
        </div>
      </div>
      {metodo === 'fecha' ? (
        <Input
          label="Fecha de expedición de la cédula"
          type="date"
          required
          disabled={disabled}
          min="1950-01-01"
          max={new Date().toISOString().slice(0, 10)}
          hint="Está impresa en el anverso de su cédula"
          error={errors.fechaExpedicion?.message}
          {...register('fechaExpedicion')}
        />
      ) : (
        <Input
          label="Código dactilar"
          placeholder="V4443V4442"
          maxLength={10}
          autoCapitalize="characters"
          icono="fingerprint"
          className="[&_input]:font-mono [&_input]:uppercase [&_input]:tracking-widest"
          hint="Está en el reverso de la cédula: letra, 4 dígitos, letra y 4 dígitos"
          required
          disabled={disabled}
          error={errors.codigoDactilar?.message}
          {...conFiltro(register('codigoDactilar'), dactilar)}
        />
      )}
    </div>
  )
}

/** Aviso de intentos restantes o de bloqueo temporal con cuenta regresiva. */
export function BloqueoAviso({ bloqueo, mensajeBloqueo, maxIntentos = 3 }) {
  if (bloqueo.bloqueado) {
    return (
      <div
        role="alert"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-800 p-5 text-white shadow-lg animate-fade-in"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-40" />
        <div className="relative flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Icon name="lock" className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{mensajeBloqueo}</p>
            <p className="mt-1 text-xs text-red-100">Podrá intentarlo de nuevo en</p>
          </div>
        </div>
        <p className="relative mt-3 text-center font-mono text-4xl font-bold tabular-nums tracking-wider" aria-live="polite">
          {bloqueo.tiempo}
        </p>
      </div>
    )
  }
  if (bloqueo.intentosRestantes !== null) {
    const usados = maxIntentos - bloqueo.intentosRestantes
    return (
      <div role="alert" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 animate-fade-in">
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: maxIntentos }, (_, i) => (
            <span key={i} className={`h-2 w-5 rounded-full ${i < usados ? 'bg-amber-500' : 'bg-amber-200'}`} />
          ))}
        </div>
        <p className="text-sm font-medium text-amber-900">
          {bloqueo.intentosRestantes === 1
            ? 'Le queda 1 intento antes del bloqueo temporal.'
            : `Le quedan ${bloqueo.intentosRestantes} intentos antes del bloqueo temporal.`}
        </p>
      </div>
    )
  }
  return null
}
