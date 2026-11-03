import { Spinner } from './Spinner'

const variantes = {
  primary: 'bg-tinta text-white hover:bg-[#2b2b2b] disabled:bg-[#8a8a8a]',
  secondary: 'bg-realce text-tinta hover:bg-control disabled:text-tenue',
  ghost: 'text-tinta underline-offset-4 hover:underline disabled:text-tenue',
  danger: 'text-mal underline-offset-4 hover:underline disabled:text-tenue',
}

// Botón con estado de carga: se deshabilita y muestra un spinner mientras loading=true.
export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 lg:min-h-10 ${variantes[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4" label="Procesando" />}
      {children}
    </button>
  )
}
