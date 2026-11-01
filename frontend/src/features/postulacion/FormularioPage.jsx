import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { postulacionApi } from '../../api/postulacion'
import { Alert, Button, ErrorAlert, Icon, PageLoader, ProgressRing, Stepper } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useAuthStore } from '../../store/authStore'
import { EstadoBadge, FormularioContext } from './components'
import { PostulacionCerrada } from './PostulacionCerrada'
import { SECCIONES, anteriorSeccion, siguienteSeccion } from './secciones'
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

const primerNombre = (u) => u?.nombres?.split(' ')[0] ?? ''

const VENTAJAS = [
  { icono: 'id', titulo: 'Datos precargados', texto: 'Sus datos personales llegan directo del Registro Civil.' },
  { icono: 'save', titulo: 'Guarde su avance', texto: 'Complete las secciones a su ritmo y continúe cuando quiera.' },
  { icono: 'file', titulo: 'Código único', texto: 'Al enviar recibirá un comprobante con su código de postulación.' },
]

/** Pantalla inicial cuando el usuario todavía no tiene postulación. */
function IniciarPostulacion({ onIniciar, peticion }) {
  const usuario = useAuthStore((s) => s.usuario)
  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <div className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-slate-900/5 lg:grid lg:grid-cols-[1.1fr_1fr]">
        <div className="relative overflow-hidden bg-brand-950 px-7 py-10 text-white sm:px-10">
          <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-50" />
          <div aria-hidden="true" className="absolute -right-24 -top-24 size-80 rounded-full bg-gold-500/25 blur-3xl animate-float" />
          <div aria-hidden="true" className="absolute -bottom-28 -left-16 size-72 rounded-full bg-brand-500/40 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-200 ring-1 ring-inset ring-white/15">
              <Icon name="sparkles" className="size-3.5" />
              Convocatoria 2026
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Hola{primerNombre(usuario) && `, ${primerNombre(usuario)}`} 👋
            </h1>
            <p className="mt-3 max-w-sm text-base leading-relaxed text-brand-100/80">
              Está a un paso de postularse al Directorio del BIESS mediante el Concurso Público de Méritos y Oposición.
            </p>
            <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
              <Icon name="info" className="size-5 text-gold-300" />
              <p className="text-sm text-brand-100/90">Solo pueden postular personas de nacionalidad ecuatoriana.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center px-7 py-10 sm:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-600">Antes de empezar</p>
          <ul className="mt-5 space-y-5">
            {VENTAJAS.map((v) => (
              <li key={v.titulo} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <Icon name={v.icono} className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{v.titulo}</p>
                  <p className="text-sm text-slate-500">{v.texto}</p>
                </div>
              </li>
            ))}
          </ul>
          <ErrorAlert error={peticion.error} className="mt-6" />
          <Button onClick={onIniciar} loading={peticion.loading} className="mt-8 w-full">
            Iniciar mi postulación
            {!peticion.loading && <Icon name="arrowRight" className="size-4" strokeWidth={2.4} />}
          </Button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Una vez enviada, la postulación ya no podrá modificarse.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Cabecera con el código, el estado y el anillo de avance. */
function Cabecera({ postulacion, completas, total }) {
  const usuario = useAuthStore((s) => s.usuario)
  const enviada = postulacion.estado === 'ENVIADA'
  const pct = Math.round((completas / total) * 100)
  return (
    <section className="no-print relative mb-6 overflow-hidden rounded-3xl bg-brand-950 px-6 py-7 text-white shadow-lift sm:px-9 sm:py-8 animate-fade-up">
      <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-40" />
      <div aria-hidden="true" className="absolute -right-16 -top-28 size-80 rounded-full bg-gold-500/20 blur-3xl animate-float" />
      <div aria-hidden="true" className="absolute -bottom-32 left-1/4 size-80 rounded-full bg-brand-500/35 blur-3xl" />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-300/90">
            {primerNombre(usuario) ? `Bienvenido/a, ${primerNombre(usuario)}` : 'Concurso Público de Méritos y Oposición'}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {enviada ? 'Postulación enviada' : 'Formulario de postulación'}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/15 backdrop-blur">
              <Icon name="file" className="size-4 text-gold-300" />
              <span className="font-mono text-sm font-bold tracking-wide">{postulacion.codigo}</span>
            </span>
            <EstadoBadge estado={postulacion.estado} className="ring-white/30" />
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-3 pr-5 ring-1 ring-inset ring-white/10 backdrop-blur sm:shrink-0">
          <ProgressRing value={completas / total} size={76} stroke={7}>
            <span className="text-lg font-extrabold leading-none">{pct}%</span>
          </ProgressRing>
          <div>
            <p className="text-sm font-bold">
              {completas} de {total} secciones
            </p>
            <p className="text-xs text-brand-100/70">{enviada ? 'Proceso finalizado' : 'completas hasta ahora'}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Botones para moverse entre secciones sin volver al menú. */
function NavegacionSecciones({ actual, irA }) {
  const anterior = anteriorSeccion(actual)
  const siguiente = siguienteSeccion(actual)
  const boton = (s, dir) =>
    s && (
      <button
        type="button"
        onClick={() => irA(s.id)}
        className={`group flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-card ring-1 ring-slate-900/5 transition-all hover:-translate-y-0.5 hover:ring-brand-200 ${
          dir === 'sig' ? 'flex-row-reverse text-right' : ''
        }`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-brand-600 group-hover:text-white">
          <Icon name={dir === 'sig' ? 'arrowRight' : 'arrowLeft'} className="size-4" strokeWidth={2.2} />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {dir === 'sig' ? 'Siguiente' : 'Anterior'}
          </span>
          <span className="block truncate text-sm font-bold text-slate-800">{s.titulo}</span>
        </span>
      </button>
    )
  return (
    <div className="no-print mt-5 flex gap-3">
      {/* En móvil, si solo hay un botón, ocupa todo el ancho */}
      {boton(anterior, 'ant') ?? <span className="hidden flex-1 sm:block" />}
      {boton(siguiente, 'sig') ?? <span className="hidden flex-1 sm:block" />}
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

  const pasos = SECCIONES.map((s) => ({
    id: s.id,
    titulo: s.titulo,
    numeral: s.numeral,
    icono: s.icono,
    completo: s.completa(postulacion),
  }))
  const completas = pasos.filter((p) => p.completo).length
  const Componente = COMPONENTES[seccionActual]

  return (
    <FormularioContext value={contexto}>
      <Cabecera postulacion={postulacion} completas={completas} total={pasos.length} />

      {postulacion.estado === 'ENVIADA' && seccionActual !== 'envio' && (
        <Alert type="success" className="no-print mb-6">
          Su postulación fue enviada y ya no admite cambios. Puede revisar cada sección en modo de solo lectura.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[17.5rem_1fr]">
        <aside className="no-print lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-900/5">
            <p className="hidden px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:block">
              Secciones
            </p>
            <Stepper steps={pasos} actual={seccionActual} onSelect={irA} />
          </div>
        </aside>

        <div className="min-w-0">
          {/* key: al cambiar de sección el formulario se monta de nuevo con los datos guardados */}
          <Componente key={seccionActual} />
          <NavegacionSecciones actual={seccionActual} irA={irA} />
        </div>
      </div>
    </FormularioContext>
  )
}
