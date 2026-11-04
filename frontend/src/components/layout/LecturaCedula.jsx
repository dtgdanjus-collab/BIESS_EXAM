import { createContext, use, useEffect } from 'react'
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
  if (digito === undefined) return 'bg-noche-celda text-noche-tenue'
  if (malo) return 'bg-mal text-white'
  if (bueno) return 'bg-sello text-white'
  return 'bg-white text-tinta'
}

/** Lo que el sello dice en su centro según lo escrito hasta ahora. */
function lecturaDe({ provincia, tercero, verificador }, lista) {
  if (lista) return { titulo: 'Todo coincide', detalle: provincia.nombre, estado: 'bien' }
  if (verificador && !verificador.valido) return { titulo: 'No coincide', detalle: `El último dígito debía ser ${verificador.esperado}`, estado: 'mal' }
  if (tercero && !tercero.valido) return { titulo: 'No es válida', detalle: 'El tercer dígito debe ser menor que 6', estado: 'mal' }
  if (provincia && !provincia.nombre) return { titulo: 'No es válida', detalle: `${provincia.codigo} no corresponde a ninguna provincia`, estado: 'mal' }
  if (provincia) return { titulo: provincia.nombre, detalle: 'Siga escribiendo', estado: null }
  return { titulo: 'Diez dígitos', detalle: 'Se leen aquí mientras escribe', estado: null }
}

/**
 * El sello de recepción convertido en lector: un dígito en cada posición del anillo. Al quedar
 * completa y válida, el sello cae como cuando se asienta un documento.
 */
function SelloLector({ cedula }) {
  const digitos = [...cedula]
  const lectura = leerCedula(cedula)
  const { provincia, tercero, verificador } = lectura
  const lista = Boolean(verificador?.valido && provincia?.nombre && tercero?.valido)
  const texto = lecturaDe(lectura, lista)

  const mala = (i) =>
    (i < 2 && provincia && !provincia.nombre) || (i === 2 && tercero && !tercero.valido) || (i === 9 && verificador && !verificador.valido)

  return (
    <div key={lista ? 'asentado' : 'abierto'} className={`@container relative aspect-square w-full -rotate-[9deg] ${lista ? 'animate-stamp' : ''}`}>
      <svg viewBox="0 0 400 400" className="absolute inset-0 size-full overflow-visible text-white" fill="none">
        <circle cx="200" cy="200" r="197" stroke="currentColor" strokeWidth="5" />
        <circle cx="200" cy="200" r="168" stroke="currentColor" strokeWidth="1.5" />
        <g className="origin-center animate-giro">
          <path id="anillo-lector" d="M200 200m-178 0a178 178 0 1 1 356 0a178 178 0 1 1-356 0" />
          <text fill="currentColor" fontSize="15" fontWeight="500" letterSpacing="3.1">
            <textPath href="#anillo-lector">BIESS · DIRECTORIO · CONCURSO PÚBLICO DE MÉRITOS Y OPOSICIÓN · RESOLUCIÓN C.D. 701 ·</textPath>
          </text>
        </g>
      </svg>

      {Array.from({ length: 10 }, (_, i) => {
        // La primera posición queda arriba y se avanza en el sentido del reloj.
        const angulo = ((i * 36 - 90) * Math.PI) / 180
        return (
          <span
            key={`${i}-${digitos[i] ?? ''}`}
            style={{ left: `${50 + 33.5 * Math.cos(angulo)}%`, top: `${50 + 33.5 * Math.sin(angulo)}%` }}
            className={`absolute flex aspect-square w-[13%] -translate-x-1/2 -translate-y-1/2 rotate-[9deg] items-center justify-center rounded-full text-[6.5cqw] font-medium tabular-nums transition-colors ${
              digitos[i] !== undefined ? 'animate-pop' : ''
            } ${claseCelda(digitos[i], mala(i), i === 9 && lista)}`}
          >
            {digitos[i]}
          </span>
        )
      })}

      <div className="absolute left-1/2 top-1/2 w-[42%] -translate-x-1/2 -translate-y-1/2 rotate-[9deg] text-center">
        <p className={`text-[6cqw] font-medium leading-tight tracking-tight ${texto.estado === 'mal' ? 'text-[#ff9c94]' : texto.estado === 'bien' ? 'text-sello-claro' : 'text-white'}`}>
          {texto.titulo}
        </p>
        <p className="mt-[1.5cqw] text-[3.4cqw] leading-snug text-noche-tenue">{texto.detalle}</p>
      </div>
    </div>
  )
}

/**
 * Panel de las pantallas públicas: una cédula ecuatoriana no es un número cualquiera. Es
 * información redundante con el campo del formulario (que ya informa los errores), por eso queda
 * fuera del árbol de accesibilidad.
 */
export function LecturaCedula({ cedula, marca }) {
  const digitos = [...cedula]
  const { provincia, tercero, verificador } = leerCedula(cedula)

  const mala = (i) =>
    (i < 2 && provincia && !provincia.nombre) || (i === 2 && tercero && !tercero.valido) || (i === 9 && verificador && !verificador.valido)
  const lista = verificador?.valido && provincia?.nombre && tercero?.valido

  return (
    <aside className="no-print relative overflow-hidden bg-sello text-white [&_a:focus-visible]:outline-white md:min-h-[26rem] lg:sticky lg:top-0 lg:h-dvh">
      {/* El sello a toda escala: el disco negro sale del panel por la derecha y por abajo. */}
      <div aria-hidden="true" className="absolute -right-[10vw] -top-[15vw] aspect-square w-[30vw] rounded-full bg-noche md:-right-[9rem] md:top-[3rem] md:w-[40rem] lg:-right-[48vh] lg:top-[42vh] lg:w-[150vh]" />

      <div className="relative px-4 pt-3 lg:px-10 lg:pt-10 xl:px-14 xl:pt-12 [&_.text-noche-tenue]:text-white/85">{marca}</div>

      <div aria-hidden="true" className="relative px-4 pb-4 pt-3 md:hidden">
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={`${i}-${digitos[i] ?? ''}`}
              className={`flex aspect-[4/5] items-center justify-center text-xl font-medium tabular-nums ${digitos[i] !== undefined ? 'animate-pop' : ''} ${
                digitos[i] === undefined ? 'bg-black/25' : claseCelda(digitos[i], mala(i), i === 9 && lista)
              }`}
            >
              {digitos[i]}
            </span>
          ))}
        </div>
        <p className={`mt-2 truncate text-sm ${provincia && !provincia.nombre ? 'font-medium' : ''}`}>
          {provincia ? (provincia.nombre ?? `${provincia.codigo} no es una provincia`) : 'Escriba su cédula: se lee aquí, dígito por dígito'}
        </p>
      </div>

      <div aria-hidden="true" className="relative hidden px-6 pb-8 pt-8 md:block md:max-w-[52%] lg:max-w-none lg:px-10 lg:pb-0 lg:pt-[7vh] xl:px-14">
        <h2 className="max-w-[12em] text-[1.9rem] font-medium lg:text-[clamp(2.25rem,3.6vw,3.75rem)] leading-[1.03] tracking-[-0.03em]">
          Su expediente empieza por diez dígitos
        </h2>
        <p className="mt-5 max-w-[26rem] text-base leading-relaxed">
          Cada parte de la cédula dice algo: la provincia, el tipo de persona y un dígito que comprueba a los demás.
        </p>
      </div>

      <div aria-hidden="true" className="absolute bottom-6 right-6 hidden w-80 md:block lg:bottom-[4vh] lg:right-[5%] lg:w-[min(46vh,34vw)]">
        <SelloLector cedula={cedula} />
      </div>
    </aside>
  )
}
