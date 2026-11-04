/** Monograma del producto: el sello de recepción reducido a su letra. */
export function Monograma({ className = 'size-8' }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`${className} shrink-0`}>
      <circle cx="16" cy="16" r="14" fill="white" stroke="#1d5fbf" strokeWidth="2.5" />
      <path d="M12 9h5.2a3.6 3.6 0 0 1 1.9 6.7A3.9 3.9 0 0 1 17.6 23H12z" fill="none" stroke="#1d5fbf" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M12 15.8h6" stroke="#1d5fbf" strokeWidth="2.4" />
    </svg>
  )
}
