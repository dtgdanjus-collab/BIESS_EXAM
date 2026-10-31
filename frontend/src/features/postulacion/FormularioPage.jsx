import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { postulacionApi } from '../../api/postulacion'
import { Alert, Button, Card, ErrorAlert, PageLoader, Stepper } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { EstadoBadge, FormularioContext } from './components'
import { PostulacionCerrada } from './PostulacionCerrada'
import { SECCIONES } from './secciones'
import { CapacitacionSection } from './sections/CapacitacionSection'
import { CargoSection } from './sections/CargoSection'
import { ContactoSection } from './sections/ContactoSection'
import { EnvioSection } from './sections/EnvioSection'
import { ExperienciaSection } from './sections/ExperienciaSection'
import { FamiliaresSection } from './sections/FamiliaresSection'
import { FormacionSection } from './sections/FormacionSection'
import { InhabilidadesSection } from './sections/InhabilidadesSection'
import { PersonalSection } from './sections/PersonalSection'
import { PublicacionesSection } from './sections/PublicacionesSection'

const COMPONENTES = {
  personal: PersonalSection,
  contacto: ContactoSection,
  familiares: FamiliaresSection,
  cargo: CargoSection,
  formacion: FormacionSection,
  experiencia: ExperienciaSection,
  publicaciones: PublicacionesSection,
  capacitacion: CapacitacionSection,
  inhabilidades: InhabilidadesSection,
  envio: EnvioSection,
}

/** Pantalla inicial cuando el usuario todavía no tiene postulación. */
function IniciarPostulacion({ onIniciar, peticion }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card title="Concurso Público de Méritos y Oposición">
        <div className="space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            Bienvenido/a al proceso de postulación para integrar el Directorio del BIESS. Al iniciar, sus datos
            personales se cargarán automáticamente desde el Registro Civil y se generará un código único de
            postulación.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Puede guardar su avance y continuar más tarde.</li>
            <li>Una vez enviada, la postulación ya no podrá modificarse.</li>
            <li>Solo pueden postular personas de nacionalidad ecuatoriana.</li>
          </ul>
          <ErrorAlert error={peticion.error} />
          <Button onClick={onIniciar} loading={peticion.loading}>
            Iniciar mi postulación
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function FormularioPage() {
  const carga = useAsync()
  const creacion = useAsync()
  const [postulacion, setPostulacion] = useState(null)
  const [noIniciada, setNoIniciada] = useState(false)
  const [params, setParams] = useSearchParams()

  const cargar = useCallback(async () => {
    const r = await carga.run(postulacionApi.obtener)
    if (r.ok) {
      setPostulacion(r.data)
      setNoIniciada(false)
    } else if (r.error.status === 404) {
      setNoIniciada(true)
    }
  }, [carga.run])

  useEffect(() => {
    cargar()
  }, [cargar])

  const iniciar = async () => {
    const r = await creacion.run(postulacionApi.crear)
    if (r.ok) {
      setPostulacion(r.data)
      setNoIniciada(false)
    } else if (r.error.details?.estado === 'CERRADA') {
      cargar() // muestra la pantalla de postulación cerrada con sus datos
    }
  }

  // Sin sección en la URL: el comprobante si ya se envió; si no, la primera sección.
  const porDefecto = postulacion?.estado === 'ENVIADA' ? 'envio' : 'personal'
  const seccionActual = SECCIONES.some((s) => s.id === params.get('seccion')) ? params.get('seccion') : porDefecto
  const irA = useCallback(
    (id) => {
      setParams({ seccion: id })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [setParams],
  )

  const contexto = useMemo(
    () =>
      postulacion && {
        postulacion,
        actualizar: setPostulacion,
        irA,
        soloLectura: postulacion.estado !== 'BORRADOR',
      },
    [postulacion, irA],
  )

  if (carga.loading && !postulacion) return <PageLoader texto="Cargando su postulación…" />
  if (noIniciada) return <IniciarPostulacion onIniciar={iniciar} peticion={creacion} />
  if (carga.error && !postulacion) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <ErrorAlert error={carga.error} title="No se pudo cargar la postulación" />
        <Button variant="secondary" onClick={cargar}>
          Reintentar
        </Button>
      </div>
    )
  }
  if (!postulacion) return null
  if (postulacion.estado === 'CERRADA') return <PostulacionCerrada postulacion={postulacion} />

  const pasos = SECCIONES.map((s) => ({ id: s.id, titulo: s.titulo, completo: s.completa(postulacion) }))
  const completas = pasos.filter((p) => p.completo).length
  const Componente = COMPONENTES[seccionActual]

  return (
    <FormularioContext value={contexto}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Formulario de postulación</h1>
          <p className="mt-1 text-sm text-slate-500">
            Código <span className="font-mono font-semibold text-slate-700">{postulacion.codigo}</span>
          </p>
        </div>
        <EstadoBadge estado={postulacion.estado} />
      </div>

      {postulacion.estado === 'ENVIADA' && (
        <Alert type="success" className="no-print mb-6">
          Su postulación fue enviada y ya no admite cambios. Puede revisar cada sección en modo de solo lectura.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <aside className="no-print lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 px-2 pt-1">
              <div className="flex justify-between text-xs font-medium text-slate-500">
                <span>Avance</span>
                <span>
                  {completas}/{pasos.length}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-1.5 rounded-full bg-brand-600 transition-all"
                  style={{ width: `${(completas / pasos.length) * 100}%` }}
                />
              </div>
            </div>
            <Stepper steps={pasos} actual={seccionActual} onSelect={irA} />
          </div>
        </aside>

        <div className="min-w-0">
          {/* key: al cambiar de sección el formulario se monta de nuevo con los datos guardados */}
          <Componente key={seccionActual} />
        </div>
      </div>
    </FormularioContext>
  )
}
