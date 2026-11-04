const MUESCAS = 12

const LECTURA = {
  vacio: 'Ingrese su usuario',
  usuario: 'Falta la contraseña',
  listo: 'Listo para ingresar',
  verificando: 'Verificando…',
  error: 'Datos incorrectos',
  bloqueado: 'Acceso bloqueado',
  autorizado: 'Autorizado',
}

/**
 * El sello de la Comisión como cerradura: el usuario se lee en el centro y cada carácter de la
 * contraseña gira el dial y enciende una muesca. Solo recibe cuántos caracteres hay, la clave
 * nunca llega aquí. Al autorizar, el sello cae. Repite lo que ya dice el formulario, por eso queda
 * fuera del árbol de accesibilidad.
 */
export function SelloCerradura({ usuario, largoClave, estado }) {
  const encendidas = Math.min(largoClave, MUESCAS)
  const rojo = estado === 'error' || estado === 'bloqueado'
  const colorMuesca = rojo ? '#ff9c94' : 'white'

  return (
    <div key={estado === 'error' || estado === 'autorizado' ? estado : 'abierto'} className={estado === 'error' ? 'animate-shake' : estado === 'autorizado' ? 'animate-stamp' : ''}>
      <div className="@container relative aspect-square w-full -rotate-[9deg]">
        <svg viewBox="0 0 400 400" className="absolute inset-0 size-full overflow-visible text-white" fill="none">
          <circle cx="200" cy="200" r="197" stroke="currentColor" strokeWidth="5" />
          <circle cx="200" cy="200" r="168" stroke="currentColor" strokeWidth="1.5" />
          <g className="origin-center animate-giro [animation-direction:reverse]">
            <path id="anillo-cerradura" d="M200 200m-178 0a178 178 0 1 1 356 0a178 178 0 1 1-356 0" />
            <text fill="currentColor" fontSize="15" fontWeight="500" letterSpacing="3.4">
              <textPath href="#anillo-cerradura">COMISIÓN DE SELECCIÓN · TALENTO HUMANO · AFILIADOS · JUBILADOS · EMPLEADORES ·</textPath>
            </text>
          </g>

          {/* El dial avanza una muesca por carácter, como el de una caja fuerte. */}
          <g
            className="transition-transform duration-300 ease-[cubic-bezier(0.3,1.5,0.6,1)]"
            style={{ transformOrigin: '200px 200px', transform: `rotate(${largoClave * (360 / MUESCAS)}deg)` }}
          >
            <circle cx="200" cy="200" r="108" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35" />
            {Array.from({ length: MUESCAS }, (_, i) => {
              // Se encienden hacia atrás para que la última quede siempre arriba al girar.
              const encendida = i >= MUESCAS - encendidas || (i === 0 && largoClave >= MUESCAS)
              return (
                <rect
                  key={i}
                  x="193"
                  y="52"
                  width="14"
                  height="44"
                  rx="7"
                  transform={`rotate(${i * (360 / MUESCAS)} 200 200)`}
                  className="transition-[fill,fill-opacity] duration-200"
                  fill={encendida ? colorMuesca : 'black'}
                  fillOpacity={encendida ? 1 : 0.25}
                />
              )
            })}
          </g>
        </svg>

        <div className="absolute left-1/2 top-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2 rotate-[9deg] text-center">
          <p className="truncate text-[7cqw] font-medium leading-tight tracking-tight">{usuario || 'Comisión'}</p>
          <p className={`mt-[1.5cqw] text-[3.8cqw] leading-snug ${rojo ? 'font-medium text-[#ffd0cb]' : 'text-white/85'}`}>{LECTURA[estado]}</p>
        </div>
      </div>
    </div>
  )
}
