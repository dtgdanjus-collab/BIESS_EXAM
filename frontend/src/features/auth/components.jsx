import { useState } from 'react'
import { useReportarCedula } from '../../components/layout/LecturaCedula'
import { Icon, Input } from '../../components/ui'
import { useTituloPagina } from '../../hooks/useTituloPagina'
import { cedulaValida } from '../../utils/cedula'
import { hoyIso } from '../../utils/fechas'
import { conFiltro, dactilar, soloDigitos } from '../../utils/filtros'
import { PERSONAS_PRUEBA } from './personasPrueba'
import { REGLAS_PASSWORD } from './schemas'

export function AuthCard({ titulo, subtitulo, children, pie }) {
  useTituloPagina(titulo)
  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight lg:text-[32px] lg:leading-tight">{titulo}</h1>
      {subtitulo && <p className="mt-2 text-sm leading-relaxed text-tenue">{subtitulo}</p>}
      <div className="mt-6">{children}</div>
      {pie && <div className="mt-6 text-sm text-tenue">{pie}</div>}
    </div>
  )
}

/** Enlace de texto de las pantallas de acceso: el relleno agranda el área táctil sin mover el texto. */
export const claseEnlace = '-my-3 inline-block py-3 font-medium text-tinta underline underline-offset-4 hover:text-sello'

export function PasswordInput({ ref, ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex size-11 items-center justify-center rounded-md text-tenue transition-colors hover:bg-realce hover:text-tinta lg:size-9"
          aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        >
          <Icon key={visible ? 'ocultar' : 'ver'} name={visible ? 'eyeOff' : 'eye'} className="size-4 animate-pop" />
        </button>
      }
      {...props}
    />
  )
}

/** Campo de cédula: solo dígitos; lo escrito se lee en el panel de la pantalla. */
export function CampoCedula({ register, error, valor, disabled }) {
  useReportarCedula(valor)
  const valida = !error && cedulaValida(valor ?? '')
  return (
    <Input
      label="Número de cédula"
      inputMode="numeric"
      maxLength={10}
      autoComplete="username"
      placeholder="0102345675"
      required
      disabled={disabled}
      error={error}
      hint={valida ? 'Cédula válida' : '10 dígitos, sin guiones'}
      className="[&_input]:tabular-nums"
      suffix={
        valida && (
          <span className="mr-2 text-sello" aria-hidden="true">
            <Icon name="check" className="size-4 animate-pop" strokeWidth={2.6} />
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
    <ul className="grid gap-1 sm:grid-cols-3" aria-label="Requisitos de la contraseña">
      {REGLAS_PASSWORD.map((r) => {
        const ok = r.cumple(valor)
        return (
          <li key={r.texto} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-emerald-800' : 'text-tenue'}`}>
            <Icon name={ok ? 'check' : 'x'} className={`size-3 ${ok ? 'animate-pop' : 'opacity-40'}`} strokeWidth={3} />
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
    <details className="group rounded-md bg-fondo text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 font-medium [&::-webkit-details-marker]:hidden">
        Demo · Personas de prueba
        <Icon name="chevronRight" className="ml-auto size-4 text-tenue transition-transform group-open:rotate-90" strokeWidth={2} />
      </summary>
      <div className="px-3 pb-3">
        <p className="text-[13px] leading-relaxed text-tenue">
          Puede usar <strong className="font-medium text-tinta">cualquier cédula válida</strong>: la
          primera vez se crea una persona ficticia con la fecha o el código que ingrese, y después esos datos deben coincidir. Estas
          personas traen escenarios preparados:
        </p>
        <ul className="mt-2 divide-y divide-realce">
          {PERSONAS_PRUEBA.map((p) => (
            <li key={p.cedula} className="flex items-center justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <p className="font-mono text-[13px]">{p.cedula}</p>
                <p className="text-[13px] text-tenue">
                  {p.escenario} · exp. {p.fecha.split('-').reverse().join('/')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUsar(p)}
                className="min-h-11 shrink-0 rounded-md px-2.5 text-[13px] lg:min-h-9 font-medium underline underline-offset-4 transition-colors hover:bg-realce"
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
  const elegir = (valor) => setValue('metodo', valor, { shouldValidate: false })
  // Grupo de radios: las flechas cambian la opción y el tabulador solo se detiene en la activa.
  const conFlechas = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const otra = metodo === 'fecha' ? 'dactilar' : 'fecha'
    elegir(otra)
    e.currentTarget.parentElement.querySelector(`[data-metodo="${otra}"]`)?.focus()
  }
  const opcion = (valor, texto) => (
    <button
      type="button"
      role="radio"
      data-metodo={valor}
      aria-checked={metodo === valor}
      tabIndex={metodo === valor ? 0 : -1}
      disabled={disabled}
      onClick={() => elegir(valor)}
      onKeyDown={conFlechas}
      className={`min-h-11 flex-1 whitespace-nowrap px-2 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md lg:min-h-9 ${
        metodo === valor ? 'bg-tinta text-white' : 'bg-realce text-tinta hover:bg-control'
      }`}
    >
      {texto}
    </button>
  )

  return (
    <div className="space-y-4">
      <CampoCedula register={register} error={errors.cedula?.message} valor={cedula} disabled={disabled} />
      <div>
        <p id="etiqueta-metodo" className="mb-1.5 text-sm font-medium">
          Validar con
        </p>
        <div role="radiogroup" aria-labelledby="etiqueta-metodo" className="flex gap-px">
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
          min="1950-01-01"
          max={hoyIso()}
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
          className="[&_input]:font-mono [&_input]:uppercase"
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
      <div role="alert" className="flex items-center justify-between gap-4 rounded-md bg-mal-fondo px-3 py-3 text-mal-tinta animate-slide-down">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{mensajeBloqueo}</p>
          <p className="mt-0.5 text-xs">Podrá intentarlo de nuevo en</p>
        </div>
        {/* Sin aria-live: un lector de pantalla leería el tiempo cada segundo. */}
        <p className="shrink-0 text-3xl font-medium tabular-nums">
          {bloqueo.tiempo}
        </p>
      </div>
    )
  }
  if (bloqueo.intentosRestantes !== null) {
    const usados = maxIntentos - bloqueo.intentosRestantes
    return (
      <div role="alert" className="flex items-center gap-3 rounded-md bg-aviso-fondo px-3 py-2.5 text-aviso-tinta animate-slide-down">
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: maxIntentos }, (_, i) => (
            <span key={i} className={`h-2 w-4 ${i < usados ? 'bg-aviso-tinta' : 'bg-control'}`} />
          ))}
        </div>
        <p className="text-sm">
          {bloqueo.intentosRestantes === 1
            ? 'Le queda 1 intento antes del bloqueo temporal.'
            : `Le quedan ${bloqueo.intentosRestantes} intentos antes del bloqueo temporal.`}
        </p>
      </div>
    )
  }
  return null
}
