import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { postulacionApi } from '../../api/postulacion'
import { EnBarra, EnCabecera } from '../../components/layout/Layouts'
import { Alert, Button, ErrorAlert, Icon, Modal, PageLoader, Pliego, SelectorFolios, Stepper } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useTituloPagina } from '../../hooks/useTituloPagina'
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

// De dónde sale el contenido de cada folio antes de abrir el expediente.
const origenFolio = (id) => {
  if (id === 'personal') return 'Llega del Registro Civil'
  if (id === 'capacitacion') return 'Opcional'
  if (id === 'envio') return 'Queda sellado'
  return 'Lo completa usted'
}

/** Pantalla inicial cuando el usuario todavía no tiene postulación. */
function IniciarPostulacion({ onIniciar, peticion }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[23rem_minmax(0,1fr)] xl:gap-8">
      <div className="flex flex-col rounded-lg bg-noche p-6 text-white [&_:focus-visible]:outline-white sm:p-8 xl:self-start">
        <h1 className="text-[28px] font-medium leading-tight tracking-tight">Su expediente aún no está abierto</h1>
        <p className="mt-3 text-sm leading-relaxed text-noche-tenue">
          Al abrirlo recibirá un código único y sus datos llegarán del Registro Civil. Solo pueden postular personas de nacionalidad
          ecuatoriana.
        </p>
        <ErrorAlert error={peticion.error} className="mt-4" />
        <Button variant="secondary" onClick={onIniciar} loading={peticion.loading} className="mt-8 w-full">
          Iniciar mi postulación
          {!peticion.loading && <Icon name="arrowRight" className="size-4" strokeWidth={2} />}
        </Button>
        <p className="mt-3 text-xs leading-relaxed text-noche-tenue">Una vez enviada, la postulación ya no podrá modificarse.</p>
      </div>
      <div className="rounded-lg border border-borde bg-papel p-4 sm:p-7">
        <h2 className="mb-2 text-base font-medium">Los diez folios de su postulación</h2>
        <ol>
          {SECCIONES.map((s) => (
            <li key={s.id} className="flex min-h-12 items-center gap-3 border-b border-regla py-2 text-sm last:border-b-0">
              <span className="flex h-7 w-10 shrink-0 items-center justify-center bg-tinta text-xs font-medium tabular-nums text-white">{s.numeral}</span>
              <span className="min-w-0 flex-1">{s.titulo}</span>
              <span className="shrink-0 text-right text-xs text-tenue">{origenFolio(s.id)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/** Cabecera negra: título del expediente, qué le falta y el pliego con una marca por folio. */
function Cabecera({ postulacion, pasos, actual, pendiente, faltan, irA }) {
  const enviada = postulacion.estado === 'ENVIADA'
  const completas = pasos.filter((p) => p.completo).length
  return (
    <header className="bg-noche px-4 pb-4 pt-5 text-white [&_:focus-visible]:outline-white sm:px-6 lg:px-8 lg:pb-5 lg:pt-7">
      <div className="mx-auto max-w-[76rem]">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-[22px] font-medium tracking-tight sm:text-[28px]">{enviada ? 'Postulación enviada' : 'Expediente de postulación'}</h1>
              <EstadoBadge estado={postulacion.estado} />
            </div>
            <p className="mt-1 text-sm text-noche-tenue">
              <span className="font-mono text-white">{postulacion.codigo}</span>
              <span aria-hidden="true"> · </span>
              {enviada
                ? 'Sellado, ya no admite cambios'
                : faltan === 0
                  ? 'Todo listo para enviar'
                  : faltan === 1
                    ? 'Falta 1 folio obligatorio'
                    : `Faltan ${faltan} folios obligatorios`}
            </p>
          </div>
          {pendiente && (
            // En el teléfono ya está el selector de folios: la cabecera no debe empujar el formulario.
            <div className="hidden animate-slide-down sm:block">
              <Button variant="secondary" onClick={() => irA(pendiente.id)}>
                Continuar: {pendiente.titulo}
                <Icon name="arrowRight" className="size-4" strokeWidth={2} />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-4 lg:mt-6 lg:gap-6">
          <p className="shrink-0 tabular-nums" aria-live="polite">
            <span className="text-[34px] font-medium leading-none tracking-tight lg:text-[40px]">{completas}</span>
            <span className="text-sm text-noche-tenue"> de {pasos.length}</span>
          </p>
          <div className="min-w-0 flex-1">
            <Pliego steps={pasos} actual={actual} onSelect={irA} />
          </div>
        </div>
      </div>
    </header>
  )
}

/** Enlaces para moverse entre secciones sin volver al índice. */
function NavegacionSecciones({ actual, irA, anchoCompleto }) {
  const anterior = anteriorSeccion(actual)
  const siguiente = siguienteSeccion(actual)
  const enlace = (s, dir) =>
    s && (
      <button
        type="button"
        onClick={() => irA(s.id)}
        className={`group flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-md border border-borde bg-papel px-4 py-2 text-left text-sm transition-colors hover:border-tinta hover:bg-tinta hover:text-white ${dir === 'sig' ? 'justify-end text-right' : ''}`}
      >
        {dir === 'ant' && <Icon name="arrowLeft" className="size-4 transition-transform group-hover:-translate-x-0.5" />}
        <span className="min-w-0">
          <span className="block text-xs text-tenue transition-colors group-hover:text-noche-tenue">{dir === 'sig' ? 'Siguiente' : 'Anterior'}</span>
          <span className="block font-medium">{s.titulo}</span>
        </span>
        {dir === 'sig' && <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-0.5" />}
      </button>
    )
  return (
    <div className={`no-print mt-4 flex gap-4 ${anchoCompleto ? '' : 'xl:pl-[19rem]'}`}>
      {enlace(anterior, 'ant')}
      {enlace(siguiente, 'sig')}
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

  // Dirección de la transición: avanzar entra por la derecha, retroceder por la izquierda.
  const indiceActual = SECCIONES.findIndex((s) => s.id === seccionActual)
  const indicePrevio = useRef(indiceActual)
  const direccion = useRef('')
  if (indicePrevio.current !== indiceActual) {
    direccion.current = indiceActual > indicePrevio.current ? 'animate-slide-right' : 'animate-slide-left'
    indicePrevio.current = indiceActual
  }
  const navegar = useCallback(
    (id) => {
      setParams({ seccion: id })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [setParams],
  )

  // Lo escrito vive en el formulario del folio: si no se guardó, se pierde al cambiar de folio.
  const cambios = useRef(false)
  const [destino, setDestino] = useState(null)
  const irA = useCallback(
    (id) => {
      if (id !== seccionActual && cambios.current) setDestino(id)
      else navegar(id)
    },
    [seccionActual, navegar],
  )

  useEffect(() => {
    const alSalir = (e) => {
      if (cambios.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [])

  // Al cambiar de folio el foco acompaña al contenido, y lo descartado deja de contar como pendiente.
  const contenido = useRef(null)
  const seccionPrevia = useRef(seccionActual)
  useEffect(() => {
    if (seccionPrevia.current === seccionActual) return
    seccionPrevia.current = seccionActual
    cambios.current = false
    contenido.current?.focus({ preventScroll: true })
  }, [seccionActual])

  useTituloPagina(
    noIniciada
      ? 'Iniciar postulación'
      : postulacion?.estado === 'CERRADA'
        ? 'Postulación cerrada'
        : postulacion
          ? SECCIONES[indiceActual].titulo
          : 'Expediente',
  )

  const contexto = useMemo(
    () =>
      postulacion && {
        postulacion,
        actualizar: (p) => {
          cambios.current = false
          setPostulacion(p)
        },
        irA,
        soloLectura: postulacion.estado !== 'BORRADOR',
      },
    [postulacion, irA],
  )

  if (carga.loading && !postulacion) return <PageLoader texto="Cargando su postulación…" />
  if (noIniciada) return <IniciarPostulacion onIniciar={iniciar} peticion={creacion} />
  if (carga.error && !postulacion) {
    return (
      <div className="max-w-xl space-y-4">
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
    completo: s.completa(postulacion),
  }))
  const Componente = COMPONENTES[seccionActual]
  // Folios obligatorios sin completar; el botón "Continuar" lleva al primero distinto del visible.
  const obligatorios = SECCIONES.filter((s) => s.id !== 'capacitacion' && s.id !== 'envio' && !s.completa(postulacion))
  const pendiente = postulacion.estado === 'BORRADOR' ? obligatorios.find((s) => s.id !== seccionActual) : null

  return (
    <FormularioContext value={contexto}>
      <EnBarra>
        <Stepper steps={pasos} actual={seccionActual} onSelect={irA} />
      </EnBarra>

      <EnCabecera>
        <Cabecera
          postulacion={postulacion}
          pasos={pasos}
          actual={seccionActual}
          pendiente={pendiente}
          faltan={obligatorios.length}
          irA={irA}
        />
      </EnCabecera>

      <div className="no-print mb-5">
        <SelectorFolios steps={pasos} actual={seccionActual} onSelect={irA} />
      </div>

      {postulacion.estado === 'ENVIADA' && seccionActual !== 'envio' && (
        <Alert type="success" className="no-print mb-6">
          Su postulación fue enviada y ya no admite cambios. Puede revisar cada sección en modo de solo lectura.
        </Alert>
      )}

      <div
        ref={contenido}
        tabIndex={-1}
        className="outline-none"
        onChange={() => {
          // Marcar el consentimiento no es un dato del expediente que se pueda perder.
          if (seccionActual !== 'envio') cambios.current = true
        }}
      >
        {/* key: al cambiar de sección el formulario se monta de nuevo con los datos guardados */}
        <div key={seccionActual} className={direccion.current}>
          <Componente />
        </div>
      </div>
      {/* El comprobante ocupa todo el ancho: no tiene la columna del título del folio. */}
      <NavegacionSecciones actual={seccionActual} irA={irA} anchoCompleto={postulacion.estado === 'ENVIADA' && seccionActual === 'envio'} />

      <Modal
        open={destino !== null}
        onClose={() => setDestino(null)}
        title="Tiene cambios sin guardar"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDestino(null)}>
              Seguir editando
            </Button>
            <Button
              onClick={() => {
                cambios.current = false
                navegar(destino)
                setDestino(null)
              }}
            >
              Salir sin guardar
            </Button>
          </>
        }
      >
        Si sale de este folio se perderá lo que escribió. Para conservarlo, siga editando y pulse «Guardar progreso».
      </Modal>
    </FormularioContext>
  )
}
