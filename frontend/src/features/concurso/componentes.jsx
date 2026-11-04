import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { postulacionApi } from '../../api/postulacion'
import { Alert, PageLoader } from '../../components/ui'
import { AuthCard, claseEnlace } from '../auth/components'

export const formatoInstante = (iso) =>
  iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

const periodo = (f) => {
  if (f.fechaInicio && f.fechaFin) return `Del ${formatoInstante(f.fechaInicio)} al ${formatoInstante(f.fechaFin)}`
  if (f.fechaInicio) return `Desde el ${formatoInstante(f.fechaInicio)}`
  if (f.fechaFin) return `Hasta el ${formatoInstante(f.fechaFin)}`
  return null
}

export function ListaFases({ fases }) {
  if (fases.length === 0) return <p className="text-sm text-tenue">Aún no se han publicado fases.</p>
  return (
    <ol className="divide-y divide-regla">
      {fases.map((f) => (
        <li key={f.codigo} className="py-3 first:pt-0 last:pb-0">
          <p className="text-sm font-medium">{f.nombre}</p>
          {periodo(f) && <p className="mt-0.5 text-xs text-tenue">{periodo(f)}</p>}
          {f.descripcion && <p className="mt-1 text-sm leading-relaxed">{f.descripcion}</p>}
        </li>
      ))}
    </ol>
  )
}

/** Página pública con las fases que el administrador publicó (EF-13.1). */
export function FasesPage() {
  const [datos, setDatos] = useState(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    postulacionApi.concursoPublico().then(setDatos).catch(() => setFallo(true))
  }, [])

  return (
    <AuthCard
      titulo="Fases del concurso"
      subtitulo="Concurso Público de Méritos y Oposición para el Directorio del BIESS."
      pie={
        <Link to="/login" className={claseEnlace}>
          Volver a iniciar sesión
        </Link>
      }
    >
      {fallo && <Alert type="error">No se pudieron cargar las fases.</Alert>}
      {!datos && !fallo && <PageLoader texto="Cargando…" />}
      {datos && (
        <div className="space-y-4">
          {!datos.formularioAbierto && <Alert type="warning">El formulario de postulación no está habilitado en este momento.</Alert>}
          <ListaFases fases={datos.fases} />
        </div>
      )}
    </AuthCard>
  )
}
