const fechaCorta = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

/** Sello de recepción en tinta azul. caer: lo estampa con animación (recién enviada). */
export function Sello({ fecha, caer = false, className = '' }) {
  return (
    <svg
      viewBox="0 0 140 140"
      role="img"
      aria-label={`Sello de recepción del BIESS, ${fechaCorta(fecha)}`}
      className={`size-28 shrink-0 -rotate-[9deg] text-sello sm:size-32 ${caer ? 'animate-stamp' : ''} ${className}`}
    >
      <defs>
        <path id="sello-arco" d="M70 70m-51 0a51 51 0 1 1 102 0a51 51 0 1 1-102 0" />
      </defs>
      <circle cx="70" cy="70" r="66" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="70" cy="70" r="40" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fill="currentColor" fontSize="11.5" fontWeight="500" letterSpacing="1.4">
        <textPath href="#sello-arco">BIESS · DIRECTORIO · POSTULACIÓN RECIBIDA ·</textPath>
      </text>
      <text x="70" y="66" textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="700">
        RECIBIDA
      </text>
      <text x="70" y="83" textAnchor="middle" fill="currentColor" fontSize="10.5" fontWeight="500">
        {fechaCorta(fecha)}
      </text>
    </svg>
  )
}
