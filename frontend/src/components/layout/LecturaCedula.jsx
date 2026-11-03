import { createContext, use, useEffect } from 'react'
import { SECCIONES } from '../../features/postulacion/secciones'
import { leerCedula } from '../../utils/cedula'

/** Lleva la cédula que se está escribiendo en el formulario hasta el panel de lectura. */
export const CedulaEnVivo = createContext(null)

export function useReportarCedula(valor) {
  const reportar = use(CedulaEnVivo)
  useEffect(() => {
    reportar?.(valor ?? '')
  }, [reportar, valor])
}

const claseCelda = (digito, malo, bueno) => {
  if (digito === undefined) return 'bg-noche-celda'
  if (malo) return 'bg-mal text-white'
  if (bueno) return 'bg-sello text-white'
  return 'bg-white text-tinta'
}

function Fila({ etiqueta, valor, estado }) {
  const color = estado === 'mal' ? 'text-[#ff9c94]' : estado === 'bien' ? 'text-sello-claro' : 'text-white'
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-noche-tenue">{etiqueta}</dt>
      <dd className={`text-right tabular-nums ${valor ? color : 'text-noche-tenue'}`}>{valor ?? '—'}</dd>
    </div>
  )
}

/**
 * Panel de las pantallas públicas: una cédula ecuatoriana no es un número cualquiera. Los diez
 * dígitos se leen mientras se escriben: provincia, tercer dígito y verificador por módulo 10.
 * Es información redundante con el campo del formulario (que ya informa los errores), por eso
 * queda fuera del árbol de accesibilidad.
 */
export function LecturaCedula({ cedula, marca }) {
  const digitos = [...cedula]
  const { provincia, tercero, verificador } = leerCedula(cedula)

  const mala = (i) =>
    (i < 2 && provincia && !provincia.nombre) || (i === 2 && tercero && !tercero.valido) || (i === 9 && verificador && !verificador.valido)
  const lista = verificador?.valido && provincia?.nombre && tercero?.valido

  return (
    <aside className="no-print bg-noche text-white [&_a:focus-visible]:outline-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:gap-8 lg:overflow-y-auto lg:p-10 xl:p-14">
      <div className="px-4 pt-3 lg:p-0">{marca}</div>

      <div aria-hidden="true" className="px-4 pb-4 pt-3 lg:p-0">
        <h2 className="hidden max-w-xl text-3xl font-medium leading-tight tracking-tight lg:block">
          Su expediente empieza por diez dígitos
        </h2>
        <p className="mt-3 hidden max-w-lg text-base leading-relaxed text-noche-tenue lg:block">
          Cada parte de la cédula dice algo. Escriba el número en el formulario y se leerá aquí, dígito por dígito.
        </p>

        <div className="grid grid-cols-10 gap-1 lg:mt-8 xl:gap-1.5">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={`${i}-${digitos[i] ?? ''}`}
              className={`flex aspect-[4/5] items-center justify-center text-xl font-medium tabular-nums lg:text-3xl xl:text-4xl ${
                digitos[i] !== undefined ? 'animate-pop' : ''
              } ${claseCelda(digitos[i], mala(i), i === 9 && lista)}`}
            >
              {digitos[i]}
            </span>
          ))}
        </div>

        <p className={`mt-2 truncate text-xs lg:hidden ${provincia && !provincia.nombre ? 'text-[#ff9c94]' : 'text-noche-tenue'}`}>
          {provincia ? (provincia.nombre ?? `${provincia.codigo} no es una provincia`) : 'Escriba su cédula: se lee aquí, dígito por dígito'}
        </p>

        <dl className="mt-4 hidden divide-y divide-white/15 text-sm lg:block">
          <Fila
            etiqueta="Provincia, dos primeros"
            valor={provincia && (provincia.nombre ?? `${provincia.codigo} no corresponde a ninguna`)}
            estado={provincia && !provincia.nombre ? 'mal' : null}
          />
          <Fila
            etiqueta="Tercero, menor que 6"
            valor={tercero && `${tercero.valor}${tercero.valido ? '' : ', no es menor que 6'}`}
            estado={tercero && !tercero.valido ? 'mal' : null}
          />
          <Fila
            etiqueta="Último, módulo 10"
            valor={verificador && (verificador.valido ? `${verificador.valor}, coincide` : `${verificador.valor}, debía ser ${verificador.esperado}`)}
            estado={verificador && (verificador.valido ? 'bien' : 'mal')}
          />
        </dl>
      </div>

      <div aria-hidden="true" className="hidden lg:block">
        <p className="text-sm text-noche-tenue">Después vienen los folios de su postulación</p>
        <ol className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {SECCIONES.map((s) => (
            <li key={s.id} className="flex gap-2">
              <span className="w-7 shrink-0 tabular-nums text-noche-tenue">{s.numeral}</span>
              <span className="truncate">{s.titulo}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
