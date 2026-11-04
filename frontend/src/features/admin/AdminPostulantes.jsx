import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { Alert, Button, ErrorAlert, Input, PageLoader, Select, Textarea } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useCatalogo } from '../../hooks/useCatalogo'
import { useTituloPagina } from '../../hooks/useTituloPagina'
import { guardarArchivo } from '../../utils/descargas'
import { textoDuracion } from '../../utils/fechas'
import { FormularioVista } from '../postulacion/FormularioVista'
import { TablaEventos } from './AdminReportes'
import { Panel, Tabla, Titulo, nota } from './comunes'

const ESTADOS = [
  { id: 'ENVIADA', nombre: 'Enviada' },
  { id: 'BORRADOR', nombre: 'Borrador' },
  { id: 'CERRADA', nombre: 'Cerrada' },
]
export const ESTADOS_CONCURSO = [
  { id: 'POSTULADO', nombre: 'En revisión' },
  { id: 'EVALUACION_TECNICA', nombre: 'Superó méritos: Evaluación Técnica' },
  { id: 'NO_SUPERA_MERITOS', nombre: 'No superó méritos' },
]
const nombreEstadoConcurso = (id) => ESTADOS_CONCURSO.find((e) => e.id === id)?.nombre ?? id

/** Dashboard: postulantes por cargo, actualizado cada 15 segundos. */
export function PanelPage() {
  useTituloPagina('Panel')
  const [datos, setDatos] = useState(null)
  const carga = useAsync()

  useEffect(() => {
    const leer = async () => {
      const r = await carga.run(adminApi.dashboard)
      if (r.ok) setDatos(r.data)
    }
    leer()
    const t = setInterval(leer, 15000)
    return () => clearInterval(t)
  }, [carga.run])

  if (!datos) return carga.error ? <ErrorAlert error={carga.error} /> : <PageLoader />
  const total = datos.cargos.reduce((n, c) => n + c.enviadas, 0)

  return (
    <div className="space-y-6">
      <Titulo texto="Panel" detalle={`Actualizado ${new Date(datos.generado).toLocaleTimeString('es-EC')} · se refresca cada 15 segundos`} />
      <dl className="grid gap-px overflow-hidden rounded-lg border border-borde bg-regla sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Postulaciones enviadas', total],
          ['Cuentas registradas', datos.cuentas],
          ['Con posible inhabilidad', datos.posibleInhabilidad],
          ['Cerradas', datos.cerradas],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="bg-papel p-4">
            <dt className="text-xs text-tenue">{etiqueta}</dt>
            <dd className="mt-1 text-[32px] font-medium leading-none tabular-nums">{valor}</dd>
          </div>
        ))}
      </dl>
      <Panel titulo="Postulantes por cargo">
        <Tabla
          columnas={['Cargo', 'Enviadas', 'En borrador', '']}
          filas={datos.cargos.map((c) => [
            c.cargo,
            <span className="font-medium tabular-nums">{c.enviadas}</span>,
            <span className="tabular-nums">{c.borradores}</span>,
            <Link className="underline underline-offset-4" to={`/admin/postulantes?sector=${c.sectorCodigo}`}>Ver nómina</Link>,
          ])}
        />
        {datos.sinCargo > 0 && <p className="mt-3 text-xs text-tenue">{datos.sinCargo} borradores aún no eligen cargo.</p>}
      </Panel>
    </div>
  )
}

/** Nómina con filtros y exportación de la matriz (EF-13.3). */
export function PostulantesPage() {
  useTituloPagina('Postulantes')
  const sectores = useCatalogo('sectores')
  const inicial = new URLSearchParams(window.location.search).get('sector') ?? ''
  const [filtro, setFiltro] = useState({ sector: inicial, estado: '', estadoConcurso: '', q: '' })
  const [lista, setLista] = useState([])
  const carga = useAsync()
  const exportar = useAsync()

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await carga.run(() => adminApi.postulantes(filtro))
      if (r.ok) setLista(r.data)
    }, 250)
    return () => clearTimeout(t)
  }, [carga.run, filtro])

  const cambiar = (campo) => (e) => setFiltro((f) => ({ ...f, [campo]: e.target.value }))
  const bajar = async (tipo) => {
    const r = await exportar.run(() => (tipo === 'xlsx' ? adminApi.matrizXlsx(filtro) : adminApi.matrizPdf(filtro)))
    if (r.ok) guardarArchivo(r.data, `matriz-postulantes.${tipo}`)
  }

  return (
    <div className="space-y-6">
      <Titulo texto="Postulantes" detalle={`${lista.length} en esta nómina`}>
        <Button variant="secondary" onClick={() => bajar('xlsx')} disabled={exportar.loading}>Exportar Excel</Button>
        <Button variant="secondary" onClick={() => bajar('pdf')} disabled={exportar.loading}>Exportar PDF</Button>
      </Titulo>
      <ErrorAlert error={exportar.error} />
      <div className="grid gap-3 rounded-lg border border-borde bg-papel p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Buscar" placeholder="Cédula, nombre o código" value={filtro.q} onChange={cambiar('q')} />
        <Select label="Cargo" placeholder="Todos" options={sectores.data} getValue={(s) => s.codigo} getLabel={(s) => s.codigo} value={filtro.sector} onChange={cambiar('sector')} />
        <Select label="Estado" placeholder="Todos" options={ESTADOS} value={filtro.estado} onChange={cambiar('estado')} />
        <Select label="Estado en el concurso" placeholder="Todos" options={ESTADOS_CONCURSO} value={filtro.estadoConcurso} onChange={cambiar('estadoConcurso')} />
      </div>
      <ErrorAlert error={carga.error} />
      <Panel>
        <Tabla
          vacio="No hay postulantes con este filtro."
          columnas={['Código', 'Postulante', 'Cédula', 'Cargo', 'Estado', 'Concurso', 'Méritos', 'Teórica', 'Psicot.', '']}
          filas={lista.map((p) => [
            <span className="whitespace-nowrap font-mono text-xs">{p.codigo}</span>,
            <span>
              {p.apellidos} {p.nombres}
              {p.posibleInhabilidad && <span className="ml-2 whitespace-nowrap rounded bg-mal-fondo px-1.5 py-0.5 text-xs text-mal-tinta">Posible inhabilidad</span>}
            </span>,
            <span className="tabular-nums">{p.cedula}</span>,
            p.sectorCodigo ?? '—',
            p.estado,
            nombreEstadoConcurso(p.estadoConcurso),
            nota(p.puntajeMeritos),
            nota(p.notaTeorica),
            nota(p.notaPsicotecnica),
            <Link className="underline underline-offset-4" to={`/admin/postulantes/${p.postulacionId}`}>Ver</Link>,
          ])}
        />
      </Panel>
    </div>
  )
}

function FormularioCalificacion({ postulante, calculado, onGuardado }) {
  const peticion = useAsync()
  const [v, setV] = useState({
    estadoConcurso: postulante.estadoConcurso,
    puntajeMeritos: postulante.puntajeMeritos ?? '',
    notaPsicotecnica: postulante.notaPsicotecnica ?? '',
    observacion: postulante.observacion ?? '',
  })
  const campos = peticion.error?.details?.campos
  const cambiar = (campo) => (e) => setV((x) => ({ ...x, [campo]: e.target.value }))
  const numero = (x) => (x === '' ? null : Number(x))

  const guardar = async (e) => {
    e.preventDefault()
    const r = await peticion.run(() =>
      adminApi.calificar(postulante.postulacionId, {
        estadoConcurso: v.estadoConcurso,
        puntajeMeritos: numero(v.puntajeMeritos),
        notaPsicotecnica: numero(v.notaPsicotecnica),
        observacion: v.observacion,
      }),
    )
    if (r.ok) onGuardado()
  }

  return (
    <form onSubmit={guardar} noValidate className="grid gap-4 sm:grid-cols-3">
      <Select label="Resultado" required placeholder="Seleccione…" options={ESTADOS_CONCURSO} value={v.estadoConcurso} error={campos?.estadoConcurso} onChange={cambiar('estadoConcurso')} />
      <div>
        <Input label="Puntaje de méritos (0 a 100)" inputMode="decimal" value={v.puntajeMeritos} error={campos?.puntajeMeritos} onChange={cambiar('puntajeMeritos')} />
        {calculado !== undefined && (
          <button type="button" className="mt-1 text-xs underline underline-offset-4" onClick={() => setV((x) => ({ ...x, puntajeMeritos: calculado }))}>
            Usar el calculado: {calculado.toFixed(2)}
          </button>
        )}
      </div>
      <Input label="Nota psicotécnica (0 a 100)" inputMode="decimal" value={v.notaPsicotecnica} error={campos?.notaPsicotecnica} onChange={cambiar('notaPsicotecnica')} />
      <Textarea label="Observación" className="sm:col-span-3" maxLength={2000} value={v.observacion} error={campos?.observacion} onChange={cambiar('observacion')} />
      <div className="space-y-3 sm:col-span-3">
        {!campos && <ErrorAlert error={peticion.error} />}
        {peticion.success && <Alert type="success">Calificación guardada.</Alert>}
        <Button type="submit" loading={peticion.loading}>Guardar calificación</Button>
      </div>
    </form>
  )
}

/** Formulario íntegro de un postulante, sus certificados, su experiencia y su calificación. */
export function PostulanteDetallePage() {
  const { id } = useParams()
  useTituloPagina('Postulante')
  const carga = useAsync()
  const descarga = useAsync()
  const [d, setD] = useState(null)

  const cargar = useCallback(async () => {
    const r = await carga.run(() => adminApi.detalle(id))
    if (r.ok) setD(r.data)
  }, [carga.run, id])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!d) return carga.error ? <ErrorAlert error={carga.error} /> : <PageLoader />
  const p = d.postulante
  const reporte = async () => {
    const r = await descarga.run(() => adminApi.reporteEvaluacion(id))
    if (r.ok) guardarArchivo(r.data, `evaluacion-${p.codigo}.pdf`)
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/postulantes" className="no-print text-sm underline underline-offset-4">Volver a la nómina</Link>
      <Titulo texto={`${p.apellidos} ${p.nombres}`} detalle={`${p.codigo} · ${p.estado} · ${p.cargo ?? 'Sin cargo'}`}>
        <Button variant="secondary" onClick={() => window.print()}>Imprimir</Button>
      </Titulo>
      {p.posibleInhabilidad && <Alert type="warning">Declaró al menos una posible inhabilidad: revise la sección 1.9.</Alert>}

      <Panel titulo="Calculadora de experiencia">
        <dl className="grid gap-4 sm:grid-cols-3">
          {[['General', d.experienciaTotal.general], ['En dirección', d.experienciaTotal.direccion], ['Total', d.experienciaTotal.total]].map(([e, v]) => (
            <div key={e}>
              <dt className="text-xs text-tenue">{e}</dt>
              <dd className="mt-0.5 text-sm tabular-nums">{textoDuracion(v)}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {d.meritos && (
        <Panel titulo="Méritos según la tabla de la Comisión">
          <dl className="grid gap-4 sm:grid-cols-5">
            {[['Formación', d.meritos.formacion], ['Experiencia', d.meritos.experiencia], ['Publicaciones', d.meritos.publicaciones], ['Capacitación', d.meritos.capacitacion], ['Total', d.meritos.total]].map(([e, v]) => (
              <div key={e}>
                <dt className="text-xs text-tenue">{e}</dt>
                <dd className={`mt-0.5 text-sm tabular-nums ${e === 'Total' ? 'font-medium' : ''}`}>{v.toFixed(2)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      <div className="no-print">
        <Panel titulo="Calificación">
          {p.estado === 'ENVIADA' ? (
            <FormularioCalificacion postulante={p} calculado={d.meritos?.total} onGuardado={cargar} />
          ) : (
            <p className="text-sm text-tenue">Solo se califican postulaciones enviadas.</p>
          )}
        </Panel>
      </div>

      {d.intento && (
        <Panel titulo="Evaluación técnica">
          {d.intento.finalizadoEn ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                Nota <strong className="font-medium tabular-nums">{d.intento.nota?.toFixed(2)}</strong> · {d.intento.correctas} de {d.intento.total} correctas
                {d.intento.forzado && ' · cerrada al terminar el tiempo'}
              </p>
              <Button variant="secondary" onClick={reporte} loading={descarga.loading} className="no-print">Reporte PDF</Button>
            </div>
          ) : (
            <p className="text-sm">En curso, termina a las {new Date(d.intento.expiraEn).toLocaleTimeString('es-EC')}.</p>
          )}
          <ErrorAlert error={descarga.error} className="mt-3" />
        </Panel>
      )}

      <Panel titulo="Formulario de postulación">
        <FormularioVista formulario={d.formulario} descargar={(doc) => adminApi.documento(id, doc.id)} />
      </Panel>

      <Panel titulo="Historial de la postulación">
        <TablaEventos eventos={d.historial ?? []} conCodigo={false} />
      </Panel>
    </div>
  )
}
